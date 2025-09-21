import BusStopPredictionsCard from './components/BusStopPredictionsCard';
import SystemTimeCard from './components/SystemTimeCard';

function App() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
            <section className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur">
                <header className="space-y-2">
                    <p className="text-sm uppercase tracking-[0.4em] text-slate-200">Where is 51B?</p>
                </header>

                <SystemTimeCard />
                <BusStopPredictionsCard routeId="51B" direction="INBOUND" stopCode="58883" />
                <BusStopPredictionsCard routeId="51B" direction="OUTBOUND" stopCode="55559" />
            </section>
        </main>
    );
}

export default App;
