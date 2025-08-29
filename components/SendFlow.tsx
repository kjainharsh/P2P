import React, { useState, useRef, useCallback } from 'react';
import { PEER_CONNECTION_CONFIG, CHUNK_SIZE } from '../constants';
import type { FileMetadata, SignalPayload, BatchStartPayload, FileEndPayload, BatchEndPayload } from '../types';
import { TransferState } from '../types';
import Button from './common/Button';
import ProgressBar from './common/ProgressBar';

interface SendFlowProps {
    onBack: () => void;
}

const SendFlow: React.FC<SendFlowProps> = ({ onBack }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [transferState, setTransferState] = useState<TransferState>(TransferState.Idle);
    const [offer, setOffer] = useState<string>('');
    const [progress, setProgress] = useState(0);
    const [totalSentBytes, setTotalSentBytes] = useState(0);
    const [totalSize, setTotalSize] = useState(0);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const fileReaderRef = useRef<FileReader | null>(null);

    const resetState = useCallback(() => {
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        dataChannelRef.current?.close();
        dataChannelRef.current = null;
        if (fileReaderRef.current) {
            fileReaderRef.current.abort();
        }
        setFiles([]);
        setTransferState(TransferState.Idle);
        setOffer('');
        setProgress(0);
        setTotalSentBytes(0);
        setTotalSize(0);
        setCurrentFileIndex(0);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(selectedFiles);
            setTotalSize(selectedFiles.reduce((acc, file) => acc + file.size, 0));
            createOffer(selectedFiles);
        }
    };
    
    const createOffer = async (selectedFiles: File[]) => {
        try {
            setTransferState(TransferState.AwaitingConnection);
            const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
            peerConnectionRef.current = pc;

            pc.onicecandidate = (event) => {
                if (event.candidate === null) {
                    const offerPayload: SignalPayload = { type: 'offer', sdp: pc.localDescription! };
                    setOffer(btoa(JSON.stringify(offerPayload)));
                }
            };
            
            pc.onconnectionstatechange = () => {
                switch(pc.connectionState) {
                    case 'connected':
                        setTransferState(TransferState.Connected);
                        break;
                    case 'disconnected':
                    case 'closed':
                        setTransferState(TransferState.Closed);
                        resetState();
                        break;
                    case 'failed':
                        setTransferState(TransferState.Failed);
                        break;
                }
            };

            const dc = pc.createDataChannel('file-transfer');
            dataChannelRef.current = dc;
            
            dc.onopen = () => {
                console.log('Data channel opened');
                sendFiles(selectedFiles);
            };

            const offerSdp = await pc.createOffer();
            await pc.setLocalDescription(offerSdp);

        } catch (error) {
            console.error("Failed to create offer:", error);
            setTransferState(TransferState.Failed);
        }
    };

    const handleAnswer = async (answerPayload: string) => {
        if (!peerConnectionRef.current || !answerPayload) return;
        try {
            setTransferState(TransferState.Connecting);
            const decodedAnswer: SignalPayload = JSON.parse(atob(answerPayload));
            if (decodedAnswer.type === 'answer') {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(decodedAnswer.sdp));
            }
        } catch (error) {
            console.error('Invalid answer or failed to set remote description:', error);
            setTransferState(TransferState.Failed);
        }
    };

    const sendFiles = (filesToSend: File[]) => {
        if (!dataChannelRef.current) return;
        setTransferState(TransferState.Transferring);
        const dataChannel = dataChannelRef.current;
        
        const filesMetadata: FileMetadata[] = filesToSend.map(f => ({ name: f.name, size: f.size, type: f.type }));
        const batchStartMessage: BatchStartPayload = { type: 'batch-start', files: filesMetadata };
        dataChannel.send(JSON.stringify(batchStartMessage));

        let fileIndex = 0;
        let currentFileOffset = 0;
        let totalOffset = 0;

        const reader = new FileReader();
        fileReaderRef.current = reader;

        const sendNextFile = () => {
            if (fileIndex >= filesToSend.length) {
                const batchEndMessage: BatchEndPayload = { type: 'batch-end' };
                dataChannel.send(JSON.stringify(batchEndMessage));
                setTransferState(TransferState.Completed);
                return;
            }
            setCurrentFileIndex(fileIndex);
            currentFileOffset = 0;
            readSlice(0);
        };

        reader.onload = (e) => {
            if (!e.target?.result) return;
            const chunk = e.target.result as ArrayBuffer;
            dataChannel.send(chunk);

            currentFileOffset += chunk.byteLength;
            totalOffset += chunk.byteLength;
            setTotalSentBytes(totalOffset);
            setProgress((totalOffset / totalSize) * 100);

            if (currentFileOffset < filesToSend[fileIndex].size) {
                readSlice(currentFileOffset);
            } else {
                const fileEndMessage: FileEndPayload = { type: 'file-end', index: fileIndex };
                dataChannel.send(JSON.stringify(fileEndMessage));
                fileIndex++;
                sendNextFile();
            }
        };

        const readSlice = (o: number) => {
            const currentFile = filesToSend[fileIndex];
            const slice = currentFile.slice(o, o + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        sendNextFile();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const currentFileName = files.length > 0 && transferState === TransferState.Transferring ? files[currentFileIndex]?.name : '';

    return (
        <div className="bg-dark-card p-8 rounded-lg border border-dark-border shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-center">Send File(s)</h2>
            
            {files.length === 0 && (
                 <div className="flex flex-col items-center justify-center border-2 border-dashed border-dark-border rounded-lg p-12 text-center">
                    <p className="mb-4 text-medium-text">Select one or more files to begin</p>
                    <input type="file" id="file-input" className="hidden" onChange={handleFileChange} multiple />
                    <label htmlFor="file-input" className="cursor-pointer bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-secondary transition-colors">
                        Choose File(s)
                    </label>
                </div>
            )}

            {files.length > 0 && transferState === TransferState.AwaitingConnection && (
                <div>
                     <div className="mb-4">
                        <p className="font-bold mb-2">Selected Files:</p>
                        <ul className="list-disc list-inside bg-gray-800 p-3 rounded-md text-sm max-h-32 overflow-y-auto">
                            {files.map((f, i) => <li key={i}>{f.name}</li>)}
                        </ul>
                    </div>
                    <p className="text-medium-text mb-2">1. Copy and send this code to the receiver:</p>
                    <div className="relative">
                        <textarea readOnly value={offer} className="w-full p-2 bg-gray-800 border border-dark-border rounded-md text-sm break-all h-24" />
                        <Button onClick={() => copyToClipboard(offer)} className="absolute top-2 right-2 text-xs">Copy</Button>
                    </div>

                    <p className="text-medium-text mt-4 mb-2">2. Paste the receiver's code here:</p>
                    <textarea 
                        placeholder="Paste receiver's code..."
                        className="w-full p-2 bg-gray-800 border border-dark-border rounded-md text-sm h-24"
                        onChange={(e) => handleAnswer(e.target.value)}
                    />
                </div>
            )}
            
            {transferState === TransferState.Connecting && <p className="text-center text-yellow-400">Connecting...</p>}
            {transferState === TransferState.Connected && <p className="text-center text-green-400">Connection established! Preparing to send...</p>}
            
            {transferState === TransferState.Transferring && (
                <div>
                    <p className="text-center mb-2">Sending file {currentFileIndex + 1} of {files.length}: <span className="font-bold">{currentFileName}</span></p>
                    <ProgressBar 
                        progress={progress}
                        currentBytes={totalSentBytes}
                        totalBytes={totalSize}
                        statusText="Overall Progress"
                    />
                </div>
            )}

            {transferState === TransferState.Completed && (
                <div className="text-center">
                    <p className="text-2xl font-bold text-green-400 mb-4">All Files Sent Successfully!</p>
                    <Button onClick={resetState}>Send More Files</Button>
                </div>
            )}

            {transferState === TransferState.Failed && (
                <div className="text-center">
                    <p className="text-2xl font-bold text-red-500 mb-4">Transfer Failed</p>
                    <p className="text-medium-text mb-4">The connection could not be established. Please try again.</p>
                    <Button onClick={resetState}>Try Again</Button>
                </div>
            )}

            <Button variant="secondary" onClick={onBack} className="mt-6 w-full">Back to Home</Button>
        </div>
    );
};

export default SendFlow;