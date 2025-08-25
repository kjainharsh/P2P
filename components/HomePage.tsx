
import React from 'react';
import type { AppView } from '../types';
import Card from './common/Card';
import { UploadIcon } from './icons/UploadIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface HomePageProps {
    setView: (view: AppView) => void;
}

const HomePage: React.FC<HomePageProps> = ({ setView }) => {
    return (
        <div className="grid md:grid-cols-2 gap-8">
            <Card
                title="Send a File"
                description="Select a file from your device and generate a secure transfer code to share with the recipient."
                icon={<UploadIcon />}
                onClick={() => setView('send')}
                buttonText="Start Sending"
            />
            <Card
                title="Receive a File"
                description="Enter the transfer code you received to establish a direct connection and download the file."
                icon={<DownloadIcon />}
                onClick={() => setView('receive')}
                buttonText="Start Receiving"
            />
        </div>
    );
};

export default HomePage;
