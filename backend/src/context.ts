import actRealtime from './services/actRealtime.js';
import gtfsRealtime from './services/gtfsRealtime.js';
import { ACTRealtimeServiceType } from './services/actRealtime.js';
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
