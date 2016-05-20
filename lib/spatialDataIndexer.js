
/**
 *
 * @module GTFS_Toolkit.spatialDataIndexer
 *
 */

'use strict';


//TODO: Should prob just return the data so that 
//         modules extending this one can easily mutate it as needed,
//         without having to load it from disk.




function run (workingDirPath, config, runMethodCallback) {

    var fs        = require('fs') ,
        process   = require('process') ,
        path      = require('path') ,
        async     = require('async') ,
        Converter = require("csvtojson").Converter ,
        turf      = require('turf') ,
        _         = require('lodash') ;



    if ( ! (workingDirPath && config && config.indexedSpatialDataFilePath) ) { 
        sendMessageToParentProcess({
            error: 'Error: Server error while indexing the GTFS spatial data.' ,
        }) ;

        runMethodCallback(new Error('Need to pass the working directory and a config object ' + 
                                    'with the indexedSpatialDataFilePath property defined.' )) ;
        return;
    }

    var jsonfile = (process.env === 'development') ? require('jsonfile') : null; // jshint ignore:line 


    var tripKeyMutator = (Array.isArray(config.tripKeyMutator)) ? config.tripKeyMutator : null;


    // Make these config options.
    var LOG_STATS = true,
        DEVIANCE_THRESHOLD = 5;  // How many feet to allow between GTFS stop location
                                 // and its projection onto the path
                                 // before logging the statistics.

    var indexingStatistics = {
        summaryStatistics : {} ,
        tripsWithAnomalies : {} ,
        tripsWithoutProjections : [] ,
        tripsRequiringRegression : [] ,
    };


    var simpleCases = 0,  // Cases where simple minification worked.
        lsqCases = 0;   // Cases requiring least squares fit.



    // Used in async.parallel to run the required GTFS data parsers.
    var gtfsFileParsers = {
        shapeID2Coords : getShapeID2Coords,
        tripID2ShapeID : getTripID2ShapeID,
        tripID2StopIDs : getTripID2StopIDs,
        stopID2Coords  : getStopIDToCoords,
    };

    var shapelessTrips = [];


    //=========== Starts the ball rolling... ============
    async.parallel(gtfsFileParsers, buildTheSpatialDataDictionary);


    // The main function that brings it all together.
    function buildTheSpatialDataDictionary (err, results) {
        var theIndexedSpatialData,

            projectionsMemoTable          = [] ,
            stopsAndPathsToMemoTableIndex = {} ,
            tripKeyToMemoTableIndex       = {} ;


        if (err) { console.log(err); return; }

        sendMessageToParentProcess({
            info: 'Indexing the GTFS spatial data.' ,
        }); 
        console.time('buildTheSpatialDataDictionary');

        // Fit the stops to the shapes.
        _.forEach(results.tripID2ShapeID, function (shapeID, tripID) { 

            var tripKey,
            
                stop_ids       = results.tripID2StopIDs[tripID],
                waypointCoords = results.shapeID2Coords[shapeID],

                stopPointCoords,
                stopsToPathKey,
                memoTableIndex,
                stopProjections;

            // Some trips don't have a shape. Just the way it goes.
            if ( ! waypointCoords ) { return; } 

            tripKey = (tripKeyMutator) ? tripID.replace(tripKeyMutator[0], tripKeyMutator[1]) : tripID;

            stopPointCoords = stop_ids.map(function(stopID) { return results.stopID2Coords[stopID]; });

            stopsToPathKey = shapeID + '|' + stop_ids.join('|'); 

            // Check the memoization table.
            memoTableIndex  = stopsAndPathsToMemoTableIndex[stopsToPathKey]; 

            // Have we already done the projections for this combo of stops and shape?
            if (memoTableIndex !== undefined) {
                tripKeyToMemoTableIndex[tripKey] = memoTableIndex;
                return;
            }

            stopProjections = fitStopsToPath(stop_ids, stopPointCoords, waypointCoords, tripID, shapeID);

            tripKeyToMemoTableIndex[tripKey] = 
                stopsAndPathsToMemoTableIndex[stopsToPathKey] = (stopProjections && projectionsMemoTable.length);

            if (stopProjections) {
                projectionsMemoTable.push(stopProjections);
            } else {
                indexingStatistics.tripsWithoutProjections.push(tripID);
            }
        });
        
        theIndexedSpatialData = { 
            shapes                         : results.shapeID2Coords  ,
            stopProjectionsTable           : projectionsMemoTable    ,
            tripKeyToProjectionsTableIndex : tripKeyToMemoTableIndex ,
        };

        sendMessageToParentProcess({
            info: 'Completed indexing the GTFS spatial data.' ,
        }) ;
        console.timeEnd('buildTheSpatialDataDictionary');

        indexingStatistics.summaryStatistics = {
            simpleFittingCases : simpleCases , 
            leastSquaresCases  : lsqCases ,
        };
        
        // Free as much memory as possible before stringifying. (String approx 60M)
        results = null; 

        async.parallel([ outputTheIndexedSpatialData.bind(null, theIndexedSpatialData), 
                         outputTheIndexingStatistics ], 

                        runMethodCallback);
    }


    function outputTheIndexedSpatialData (theIndexedSpatialData, callback) {
        sendMessageToParentProcess({
            debug: 'Writing the indexed GTFS spatial data to disk.' ,
        }) ;
        fs.writeFile(config.indexedSpatialDataFilePath, JSON.stringify(theIndexedSpatialData), function (err) {
            if (err) {
                sendMessageToParentProcess({
                    error: 'Error writing the indexed GTFS spatial data to disk.' ,
                }) ;
                return callback(err) ;
            }
            sendMessageToParentProcess({
                info: 'Successfully wrote the indexed GTFS spatial data to disk.' ,
            }) ;
            return callback(null) ;
        });
    }


    function outputTheIndexingStatistics (callback) {
        if (config.logIndexingStatistics) {
            sendMessageToParentProcess({
                debug: 'Writing the GTFS spatial data indexing statistics to disk.' ,
            }); 
            fs.writeFile(config.indexingStatisticsLogPath, JSON.stringify(indexingStatistics),function (err) {
                if (err) {
                    sendMessageToParentProcess({
                        error: 'Error writing the GTFS spatial data indexing statistics to disk.' ,
                    }) ;
                    return callback(err) ;
                }
                sendMessageToParentProcess({
                    info: 'Successfully wrote the GTFS spatial data indexing statistics to disk.' ,
                }) ;
                return callback(null) ;
            });
        } else {
            sendMessageToParentProcess({
                info: 'GTFS spatial data indexing statistics not logged (by configuration).' ,
            }) ;
            return callback(null);
        }
    }


    function fitStopsToPath (stop_ids, stopPointCoords, waypointCoords, tripID, shapeID) {

        var stopPoints   = getGeoJSPointsForGTFSPoints(stopPointCoords),
            waypoints    = getGeoJSPointsForGTFSPoints(waypointCoords),
            pathSegments = getGeoJSLineSegmentsForGTFSPathWaypoints(waypointCoords),

            theTable = getStopsProjectedToPathSegmentsTable(stop_ids, stopPoints, waypoints, pathSegments),

            originStopID      = null ,
            destinationStopID = null ,

            stopProjections,
            metadata;
        
            stopProjections = trySimpleMinification(theTable);

            if ( ! stopProjections ) {
                indexingStatistics.tripsRequiringRegression.push(tripID);
                stopProjections = fitStopsToPathUsingLeastSquares(theTable);
            }

            if (LOG_STATS) {
                logStatsForStopsToPathProjection(stopProjections, tripID);
            }

            if (Array.isArray(stopProjections) && (stopProjections.length)) {
                originStopID      = stopProjections[0].stop_id;
                destinationStopID = stopProjections[stopProjections.length - 1].stop_id;
            }

            metadata = {
                __originStopID      : originStopID ,
                __destinationStopID : destinationStopID ,
                __shapeID           : shapeID ,
            };

        // convert the stopProjections array to an object, 
        // back-link the stops,
        // and note the origin.
        if (Array.isArray(stopProjections) && stopProjections.length) {
        
            return stopProjections.reduce(function (acc, projection, i) {
                var prevStopProj = stopProjections[i-1];

                projection.previous_stop_id = prevStopProj ? prevStopProj.stop_id : null;

                acc[projection.stop_id] = projection;

                return acc;

            }, metadata) ;

        } else {
            return null;
        }
    }


    function logStatsForStopsToPathProjection (stopProjections, tripID) {
        var projection ,
            deviationInFt ,
            i ;

        for (i=0; i < stopProjections.length; ++i) {
            projection = stopProjections[i];
            deviationInFt = (projection.deviation * 5280);
            
            if (deviationInFt > DEVIANCE_THRESHOLD) {
                if (!indexingStatistics.tripsWithAnomalies[tripID]) {
                    indexingStatistics.tripsWithAnomalies[tripID] = {};
                }

                indexingStatistics.tripsWithAnomalies[tripID][projection.stop_id] = {
                    deviationInFt  : deviationInFt ,
                    stop_coords    : projection.stop_coords ,
                    snapped_coords : projection.snapped_coords ,
                };
            }
        }
    }


    // O(S W lg W) where S is the number of stops, W is the number of waypointCoords in the path.
    // Additional O(SW) space cost, as the table is replicated.
    function trySimpleMinification (theTable) {
        var possibleOptimal = theTable.map(function (row) {
            return _.first(_.sortByAll(row, ['deviation', 'snapped_dist_along_km'])); 
        });


        function invariantCheck (projectedPointA, projectedPointB) {
            return (projectedPointA.snapped_dist_along_km <= projectedPointB.snapped_dist_along_km);
        }

        if (_.every(_.rest(possibleOptimal), 
                    function (currPossOpt, i) { 
                        return invariantCheck(possibleOptimal[i], currPossOpt); 
                    })) 
        {
            ++simpleCases;
            return possibleOptimal;
        } else {
            return null;
        }
    }


    // Finds the stops-to-path fitting with the minimum 
    //      total squared distance between stops and their projection onto path line segments
    //      while maintaining the strong no-backtracking constraint.
    //
    // O(SW^2) where S is the number of stops, W is the number of waypointCoords in the path.
    //
    // NOTE: O(S W lg^2 W) is possible by using Willard's range trees on each row to find the optimal
    //       cell from the previous row from which to advance.
    /**
     *
     * @param {Array} Array of arrays. Rows = projections of stops onto each line segment of the path.
     * @returns {Array|null} an array of the best possible projections for each stop.
     */
    function fitStopsToPathUsingLeastSquares (theTable) {

        var bestAssignmentOfSegments;

        ++lsqCases; 

        // Initialize the first row.
        _.forEach(_.first(theTable), function (cell) { 
            cell.cost = (cell.deviation * cell.deviation);
            cell.path = [cell.segmentNum];
        });

        // Do dynamic programing...
        _.forEach(_.rest(theTable), function (stopRow, i) {
            _.forEach(stopRow, function (thisCell) {

                var bestFromPreviousRow = {
                    cost : Number.POSITIVE_INFINITY,
                };

                _.forEach(theTable[i], function (fromCell) {
                    if ((fromCell.snapped_dist_along_km <= thisCell.snapped_dist_along_km) && 
                        (fromCell.cost < bestFromPreviousRow.cost)) {

                        bestFromPreviousRow = fromCell;
                    }
                });

                thisCell.cost = bestFromPreviousRow.cost + (thisCell.deviation * thisCell.deviation);

                if (thisCell.cost < Number.POSITIVE_INFINITY) {
                    thisCell.path = bestFromPreviousRow.path.slice(0); // This can be done once.
                    thisCell.path.push(thisCell.segmentNum);
                } else {
                    thisCell.path = null;
                }
            });
        });


        // Did we find a path that works satisfies the constraint???
        if ((bestAssignmentOfSegments = _.min(_.last(theTable), 'cost').path)) {

            return bestAssignmentOfSegments.map(function (segmentNum, stopIndex) {
                var bestProjection = theTable[stopIndex][segmentNum];

                return {
                    segmentNum            : segmentNum                           ,
                    stop_id               : bestProjection.stop_id               ,
                    stop_coords           : bestProjection.stop_coords           ,
                    snapped_coords        : bestProjection.snapped_coords        ,
                    snapped_dist_along_km : bestProjection.snapped_dist_along_km ,
                    deviation             : bestProjection.deviation             , 
                };
            });

        } else {
            return null;
        }
    }


    function getGeoJSPointsForGTFSPoints (gtfsPts) {
        return gtfsPts.map(function (pt) {
            return turf.point([pt.longitude, pt.latitude]);
        }); 
    }


    function getGeoJSLineSegmentsForGTFSPathWaypoints (waypointCoords) {
        // By starting at the second waypoint, the index parameter to the mapping funciton 
        // points to the current waypoint parameter's previous waypoint in waypointCoords.
        return _.rest(waypointCoords).map(function (current, index) {
            var prevCoords = [waypointCoords[index].longitude, waypointCoords[index].latitude],
                currCoords = [current.longitude, current.latitude];

            return turf.lineString([prevCoords, currCoords], { start_dist_along: waypointCoords[index].dist_traveled });
        });
    }



    /* ======================================= Parse the GTFS Data ======================================= */

    // O(S*Ps) where S is the number of stopPoints, and Ps is the number of path segments.
    function getStopsProjectedToPathSegmentsTable (stop_ids, stopPoints, waypoints, pathSegments) {
        return stopPoints.map(function (stopPt, stopNumber) {
            // For each stopPt, snap it to each path segment.
            return pathSegments.map(function (segment, i) {
                var snapped             = turf.pointOnLine(segment, stopPt),
                    snappedCoords       = snapped.geometry.coordinates,

                    segmentStartPt      = waypoints[i],
                    snappedDistTraveled = turf.distance(segmentStartPt, snapped, 'kilometers') + 
                                          segment.properties.start_dist_along,

                    deviation           = turf.distance(stopPt, snapped, 'kilometers');

                return { 
                     segmentNum            : i                           ,
                     stop_id               : stop_ids[stopNumber]        ,
                     stop_coords           : stopPt.geometry.coordinates ,
                     snapped_coords        : snappedCoords               ,
                     snapped_dist_along_km : snappedDistTraveled         ,
                     deviation             : deviation                   ,
                };
            });
        });
    }


    // ShapeID to shape path coordinates
    function getShapeID2Coords (cbak) {
        console.time ('getShapeID2Coords');

        var converter  = new Converter({constructResult:true}) ,
            filePath   = path.join(workingDirPath, 'shapes.txt') ;


        sendMessageToParentProcess({
            debug: 'Reading shapes.txt' ,
        }) ;

        fs.createReadStream(filePath)
          .on('error', function (err) {
                  sendMessageToParentProcess({
                      error: 'Error reading from shapes.txt' ,
                  }) ;
                  return cbak(err) ;
              }
          ).pipe(converter) ;


        converter.on("end_parsed", function (parsedTable) {
            var shapeIDs2Coords = {},
                currPath,
                prevPoint,
                currPoint,
                distTraveled,
                seqNum,

                lastSeqNum = Number.POSITIVE_INFINITY;

            sendMessageToParentProcess({
                debug: 'Indexing shapes.txt' ,
            }) ;
            
            _.forEach(parsedTable, function (row) {
                currPoint = turf.point([row.shape_pt_lon, row.shape_pt_lat]);

                seqNum = row.shape_pt_sequence;

                if (seqNum < lastSeqNum) {
                    shapeIDs2Coords[row.shape_id] = currPath = [];
                    distTraveled = 0;
                } else {
                    distTraveled += turf.distance(prevPoint, currPoint, 'kilometers');
                }

                currPath.push( { latitude      : row.shape_pt_lat ,
                                 longitude     : row.shape_pt_lon ,
                                 dist_traveled : distTraveled     , } );

                lastSeqNum = seqNum;
                prevPoint = currPoint;
            });


            sendMessageToParentProcess({
                debug: 'Successfully indexed shapes.txt' ,
            }) ;
            console.timeEnd('getShapeID2Coords');
            return cbak(null, shapeIDs2Coords);
        });
    }



    function getTripID2ShapeID (cbak) {
        console.time('getTripID2ShapeID');

        var converter  = new Converter({constructResult:true}),
            filePath   = path.join(workingDirPath, 'trips.txt') ;


        sendMessageToParentProcess({
            debug: 'Reading trips.txt' ,
        }) ;

        fs.createReadStream(filePath)
          .on('error', function (err) {
                  sendMessageToParentProcess({
                      error: 'Error reading from trips.txt' ,
                  }) ;
                  return cbak(err) ;
              })
          .pipe(converter) ;


        converter.on("end_parsed", function (parsedTable) {
            var tripID2ShapeIDMap = {};

            sendMessageToParentProcess({
                debug: 'Indexing trips.txt',
            }) ;

            _.forEach(parsedTable, function (row) {
                if (row.shape_id) {
                    tripID2ShapeIDMap[row.trip_id] = row.shape_id;
                } else {
                    shapelessTrips.push(row.trip_id);
                }
            });

            
            sendMessageToParentProcess({
                debug: 'Successfully indexed trips.txt' ,
            }) ;
            
            console.timeEnd('getTripID2ShapeID');
            return cbak(null, tripID2ShapeIDMap);
        });
    }



    function getTripID2StopIDs (cbak) {
        console.time('getTripID2StopIDs');

        var converter  = new Converter({constructResult:true}),
            filePath   = path.join(workingDirPath, 'stop_times.txt') ;

        
        sendMessageToParentProcess({
            debug: 'Reading stop_times.txt',
        });

        fs.createReadStream(filePath)
          .on('error', function (err) {
                  sendMessageToParentProcess({
                      error: 'The spatial data indexer encountered an error reading from stop_times.txt' ,
                  });
                  return cbak(err) ;
              }
          ).pipe(converter) ;


        converter.on("end_parsed", function (parsedTable) {
            var stopTimesMap = {},
                curStopSeq,
                seqNum;

            sendMessageToParentProcess({ 
                debug: 'Indexing stop_times.txt' ,
            }) ;

            _.forEach(parsedTable, function (row) {
                seqNum = row.stop_sequence;

                if (seqNum === 1) {
                    stopTimesMap[row.trip_id] = curStopSeq = [];
                }

                curStopSeq.push(row.stop_id);
            });

            
            sendMessageToParentProcess({
                debug: 'Successfully indexed stop_times.txt' ,
            }) ;

            console.timeEnd('getTripID2StopIDs');
            return cbak(null, stopTimesMap);
        });
    }



    function getStopIDToCoords (cbak) {
        console.time('getStopIDToCoords');

        var converter  = new Converter({constructResult:true}),
            filePath   = path.join(workingDirPath, 'stops.txt') ;
            
        sendMessageToParentProcess({
            debug: 'Reading from stops.txt.' ,
        }) ;

        fs.createReadStream(filePath)
          .on('error', function (err) {
                  sendMessageToParentProcess({
                      error: 'The spatial data indexer encountered an error reading from stops.txt' ,
                  });
                  return cbak(err) ;
              }
          ).pipe(converter) ;

        converter.on("end_parsed", function (parsedTable) {
            var stopCoordsMap = {};

            sendMessageToParentProcess({
                debug: 'Indexing stops.txt' ,
            }) ;

            _.forEach(parsedTable, function (row) {
                stopCoordsMap[row.stop_id] = { latitude  : row.stop_lat , 
                                               longitude : row.stop_lon , };
            });


            sendMessageToParentProcess({
                debug: 'Successfully indexed stops.txt' ,
            }) ;

            console.timeEnd('getStopIDToCoords');
            return cbak(null, stopCoordsMap);
        });
    }
}




function sendMessageToParentProcess (message) {
    if (process.send) { 
        message.timestamp = (Date.now() + (process.hrtime()[1]%1000000)/1000000) ;
        process.send(message);
    }
}



module.exports = {
    run : run,
};
