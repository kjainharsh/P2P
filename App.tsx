
import React, { useState } from 'react';
import HomePage from './components/HomePage';
import SendFlow from './components/SendFlow';
import ReceiveFlow from './components/ReceiveFlow';
import { AppView } from './types';

const App: React.FC = () => {
    const [view, setView] = useState<AppView>('home');

    const renderContent = () => {
        switch (view) {
            case 'send':
                return <SendFlow onBack={() => setView('home')} />;
            case 'receive':
                return <ReceiveFlow onBack={() => setView('home')} />;
            case 'home':
            default:
                return <HomePage setView={setView} />;
        }
    };

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4 font-sans">
            <header className="w-full max-w-4xl text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">
                    P2P DirectDrop
                </h1>
                <p className="text-medium-text mt-2 text-lg">Serverless, Secure, and Swift File Transfer</p>
            </header>
            <main className="w-full max-w-4xl">
                {renderContent()}
            </main>
            <footer className="w-full max-w-4xl text-center mt-8 text-medium-text text-sm">
                <p>&copy; {new Date().getFullYear()} DirectDrop. All files are transferred directly peer-to-peer. No data is stored on any server.</p>
            </footer>
        </div>
    );
};

export default App;
