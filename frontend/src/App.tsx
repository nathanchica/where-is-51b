import BusRouteMap from './components/BusRouteMap';
import BusStopPredictionsCard from './components/BusStopPredictionsCard';
import SystemTimeCard from './components/SystemTimeCard';

function App() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 md:px-6 px-4 md:py-12 py-6 text-slate-100">
            <section className="w-full max-w-3xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 md:p-8 p-4 shadow-2xl shadow-slate-950/60 backdrop-blur">
                <header className="space-y-2">
                    <p className="text-sm uppercase tracking-[0.4em] text-slate-200">Where is 51B?</p>
                </header>

                <SystemTimeCard />
                <div className="space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
                    <BusStopPredictionsCard routeId="51B" direction="INBOUND" stopCode="58883" />
                    <BusStopPredictionsCard routeId="51B" direction="OUTBOUND" stopCode="55559" />
                </div>
                <BusRouteMap routeId="51B" />
            </section>
        </main>
    );
}

export default App;
