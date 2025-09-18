/**
 * Test script to verify GTFS parser works correctly
 */
import acTransitService from './acTransit.js';
import gtfsParser from './gtfsParser.js';

async function testGTFSParser() {
    console.log('🧪 Testing GTFS Parser\n');
    console.log('='.repeat(50));

    try {
        // Fetch real alerts
        console.log('\n📡 Fetching service alerts from AC Transit...');
        const alertsFeed = await acTransitService.fetchServiceAlerts();

        // Filter for 51B alerts
        const route51BFeed = acTransitService.filterByRoute(alertsFeed, '51B');

        // Parse the alerts
        console.log('\n🔄 Parsing alerts...');
        const parsedAlerts = gtfsParser.parseAlerts(route51BFeed);

        console.log(`\n✅ Parsed ${parsedAlerts.length} alerts for route 51B\n`);

        // Display parsed alerts
        parsedAlerts.forEach((alert, index) => {
            console.log(`Alert ${index + 1}:`);
            console.log('─'.repeat(40));
            console.log(`ID: ${alert.id}`);
            console.log(`Severity: ${alert.severity}`);
            console.log(`Title: ${alert.headerText}`);
            console.log(`\nDescription (English only):`);
            console.log(alert.descriptionText || 'No description');
            console.log(`\nAffected Routes: ${alert.affectedRoutes.join(', ') || 'None specified'}`);
            console.log(
                `Affected Stops: ${alert.affectedStops.length > 0 ? alert.affectedStops.join(', ') : 'None specified'}`
            );

            if (alert.startTime) {
                console.log(`Start: ${alert.startTime.toLocaleString()}`);
            }
            if (alert.endTime) {
                console.log(`End: ${alert.endTime.toLocaleString()}`);
            }
            console.log('\n');
        });

        // Test vehicle positions
        console.log('='.repeat(50));
        console.log('\n📍 Testing Vehicle Position Parsing...');
        const vehicleFeed = await acTransitService.fetchVehiclePositions();
        const allVehicles = gtfsParser.parseVehiclePositions(vehicleFeed);

        // Filter for 51B
        const route51BVehicles = gtfsParser.filterByRoute(allVehicles, '51B');

        console.log(`\n✅ Parsed ${allVehicles.length} total vehicles`);
        console.log(`✅ Found ${route51BVehicles.length} vehicles on route 51B`);

        if (route51BVehicles.length > 0) {
            console.log('\nSample 51B vehicle:');
            const vehicle = route51BVehicles[0];
            console.log('─'.repeat(40));
            console.log(`Vehicle ID: ${vehicle.vehicleId}`);
            console.log(`Route: ${vehicle.routeId}`);
            console.log(`Direction: ${vehicle.isOutbound ? 'Outbound' : 'Inbound'}`);
            console.log(`Position: ${vehicle.latitude}, ${vehicle.longitude}`);
            console.log(`Speed: ${vehicle.speed ? `${(vehicle.speed * 2.237).toFixed(1)} mph` : 'N/A'}`);
            console.log(`Heading: ${vehicle.heading ? `${vehicle.heading}°` : 'N/A'}`);
            console.log(`Last Update: ${vehicle.timestamp.toLocaleTimeString()}`);
        }

        // Test trip updates
        console.log('='.repeat(50));
        console.log('\n🚏 Testing Stop Prediction Parsing...');
        const tripFeed = await acTransitService.fetchTripUpdates();
        const allPredictions = gtfsParser.parseTripUpdates(tripFeed);

        console.log(`\n✅ Parsed predictions for ${allPredictions.length} stops`);

        // Show sample prediction
        if (allPredictions.length > 0) {
            const sample = allPredictions[0];
            console.log('\nSample stop prediction:');
            console.log('─'.repeat(40));
            console.log(`Stop ID: ${sample.stopId}`);
            console.log(`Stop Name: ${sample.stopName}`);
            console.log(`Direction: ${sample.direction}`);
            console.log(`Upcoming arrivals: ${sample.arrivals.length}`);

            if (sample.arrivals.length > 0) {
                const nextArrival = sample.arrivals[0];
                console.log(`\nNext arrival:`);
                console.log(`  Vehicle: ${nextArrival.vehicleId}`);
                console.log(`  Minutes away: ${nextArrival.minutesAway}`);
                console.log(`  Arrival time: ${nextArrival.arrivalTime.toLocaleTimeString()}`);
            }
        }

        console.log('='.repeat(50));
        console.log('\n🎉 All parser tests completed successfully!');
    } catch (error) {
        console.error('\n❌ Parser test failed:', error);
        process.exit(1);
    }
}

// Run the test
testGTFSParser().catch(console.error);
