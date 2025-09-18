/**
 * Test script to verify AC Transit API fetching works
 */
import acTransitService from './acTransit.js';

async function testACTransitFetching() {
    console.log('🚌 Testing AC Transit API Integration\n');
    console.log('='.repeat(50));

    try {
        // Test 1: Fetch vehicle positions
        console.log('\n📍 TEST 1: Vehicle Positions');
        console.log('-'.repeat(30));
        const vehiclePositions = await acTransitService.fetchVehiclePositions();

        // Test 2: Filter for route 51B
        console.log('\n🔍 Filtering for Route 51B...');
        const route51B = acTransitService.filterByRoute(vehiclePositions, '51B');
        console.log(`Found ${route51B.entity?.length || 0} entities for route 51B`);

        if (route51B.entity && route51B.entity.length > 0) {
            console.log('\n51B Vehicle Details:');
            route51B.entity.forEach((entity, index) => {
                if (entity.vehicle) {
                    const vehicle = entity.vehicle;
                    console.log(`  Bus ${index + 1}:`);
                    console.log(`    Vehicle ID: ${entity.id}`);
                    console.log(`    Trip ID: ${vehicle.trip?.tripId || 'N/A'}`);
                    console.log(
                        `    Direction: ${vehicle.trip?.directionId !== undefined ? (vehicle.trip.directionId === 0 ? 'Outbound' : 'Inbound') : 'Unknown'}`
                    );
                    console.log(`    Current Position: ${vehicle.position?.latitude}, ${vehicle.position?.longitude}`);
                    console.log(
                        `    Speed: ${vehicle.position?.speed ? `${(vehicle.position.speed * 2.237).toFixed(1)} mph` : 'N/A'}`
                    );
                    console.log(`    Heading: ${vehicle.position?.bearing || 'N/A'}°`);
                }
            });
        }

        // Test 3: Fetch trip updates
        console.log('\n='.repeat(50));
        console.log('\n📅 TEST 2: Trip Updates');
        console.log('-'.repeat(30));
        const tripUpdates = await acTransitService.fetchTripUpdates();

        // Filter trip updates for 51B
        const route51BTripUpdates = acTransitService.filterByRoute(tripUpdates, '51B');
        console.log(`\nFound ${route51BTripUpdates.entity?.length || 0} trip updates for route 51B`);

        if (
            route51BTripUpdates.entity &&
            route51BTripUpdates.entity.length > 0 &&
            route51BTripUpdates.entity[0].tripUpdate?.stopTimeUpdate
        ) {
            const firstTrip = route51BTripUpdates.entity[0].tripUpdate;
            console.log('\nSample 51B trip update:');
            console.log(`  Trip ID: ${firstTrip.trip.tripId}`);
            console.log(`  Upcoming stops: ${firstTrip.stopTimeUpdate?.length || 0}`);

            // Show next 3 stops
            if (firstTrip.stopTimeUpdate && firstTrip.stopTimeUpdate.length > 0) {
                console.log('  Next 3 stops:');
                firstTrip.stopTimeUpdate.slice(0, 3).forEach((stop, index) => {
                    const arrivalTime = stop.arrival?.time ? new Date(Number(stop.arrival.time) * 1000) : null;
                    const now = new Date();
                    const minutesAway = arrivalTime
                        ? Math.round((arrivalTime.getTime() - now.getTime()) / 60000)
                        : null;

                    console.log(`    ${index + 1}. Stop ${stop.stopId}`);
                    if (arrivalTime) {
                        console.log(`       Arrival: ${arrivalTime.toLocaleTimeString()} (${minutesAway} min)`);
                    }
                });
            }
        }

        // Test 4: Fetch service alerts
        console.log('\n='.repeat(50));
        console.log('\n⚠️  TEST 3: Service Alerts');
        console.log('-'.repeat(30));
        const serviceAlerts = await acTransitService.fetchServiceAlerts();

        // Check for 51B alerts
        const route51BAlerts = acTransitService.filterByRoute(serviceAlerts, '51B');
        if (route51BAlerts.entity && route51BAlerts.entity.length > 0) {
            console.log(`\n🚨 Found ${route51BAlerts.entity.length} alerts affecting route 51B`);
            console.log(
                route51BAlerts.entity
                    .map((e) => {
                        const alert = e.alert!;
                        const headerText = alert.headerText?.translation?.[0]?.text || 'No title';
                        const descriptionText = alert.descriptionText?.translation?.[0]?.text || 'No description';
                        return `\n---\nTitle: ${headerText}\nDetails: ${descriptionText}\n---`;
                    })
                    .join('\n')
            );
        } else {
            console.log('\n✅ No active alerts for route 51B');
        }

        console.log('\n='.repeat(50));
        console.log('\n✨ All tests completed successfully!');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testACTransitFetching().catch(console.error);
