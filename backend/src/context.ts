import actRealtime from './services/actRealtime.js';
import { ACTRealtimeServiceType } from './services/actRealtime.js';
import gtfsRealtime from './services/gtfsRealtime.js';
import { GTFSRealtimeServiceType } from './services/gtfsRealtime.js';

export type Context = {
    services: {
        actRealtime: ACTRealtimeServiceType;
        gtfsRealtime: GTFSRealtimeServiceType;
    };
};

export function createContext(): Context {
    return {
        services: {
            actRealtime,
            gtfsRealtime,
        },
    };
}
