import { gql, useQuery } from 'urql';

const BUS_STOP_CARD_HEADER_QUERY = gql`
    query GetBusStopCardHeaderData($busStopCode: String!) {
        getTransitSystem(alias: "act") {
            ... on ACTransitSystem {
                busStop(busStopCode: $busStopCode) {
                    code
                    name
                }
            }
        }
    }
`;

type BusStopCardHeaderProps = {
    busStopCode: string;
};

type GetBusStopCardHeaderDataPayload = {
    getTransitSystem: {
        busStop: {
            code: string;
            name: string;
        } | null;
    };
};

// Matches a bus stop name followed by parenthetical content, e.g. 'Shattuck Sq & Center St (Downtown Berkeley BART)'
const BUS_STOP_NAME_WITH_PARENTHETICAL_REGEX = /^(.*?)(\s*\(([^()]+)\))$/;

function splitBusStopName(name: string) {
    const trimmed = name.trim();
    const match = trimmed.match(BUS_STOP_NAME_WITH_PARENTHETICAL_REGEX);

    if (!match) {
        return { main: trimmed, parenthetical: null };
    }

    const main = match[1].trim();
    const parenthetical = match[3].trim();

    if (!main) {
        return { main: trimmed, parenthetical: null };
    }

    return { main, parenthetical };
}

function BusStopCardHeader({ busStopCode }: BusStopCardHeaderProps) {
    const [{ data, fetching, error }] = useQuery<GetBusStopCardHeaderDataPayload>({
        query: BUS_STOP_CARD_HEADER_QUERY,
        variables: { busStopCode },
    });

    const busStop = data?.getTransitSystem?.busStop;
    const showSkeleton = fetching && !busStop;
    const stopCode = busStop?.code ?? busStopCode;
    const nameParts = busStop?.name ? splitBusStopName(busStop.name) : null;

    return (
        <header className="flex flex-col gap-2">
            {showSkeleton ? (
                <>
                    <div className="h-3 w-24 rounded-sm shimmer" aria-hidden="true" />
                    <div className="h-6 w-48 rounded-md shimmer" aria-hidden="true" />
                    <div className="h-4 w-40 rounded-sm shimmer" aria-hidden="true" />
                    <span className="sr-only">Loading bus stop details</span>
                </>
            ) : (
                <>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Bus Stop {stopCode}
                    </p>
                    {nameParts ? (
                        <>
                            <h2 className="text-xl font-semibold leading-tight text-slate-100">{nameParts.main}</h2>
                            {nameParts.parenthetical ? (
                                <p className="text-slate-300">({nameParts.parenthetical})</p>
                            ) : null}
                        </>
                    ) : (
                        <h2 className="text-xl font-semibold text-slate-100 leading-tight">
                            Bus stop {stopCode} details unavailable
                        </h2>
                    )}
                    {error && !busStop ? (
                        <p className="text-xs text-red-300">Unable to load bus stop information.</p>
                    ) : null}
                </>
            )}
        </header>
    );
}

export default BusStopCardHeader;
