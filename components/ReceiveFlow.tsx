import React, { useState, useRef, useCallback } from 'react';
import { PEER_CONNECTION_CONFIG } from '../constants';
import type { FileMetadata, SignalPayload, ControlMessage } from '../types';
import { TransferState } from '../types';
import Button from './common/Button';
import ProgressBar from './common/ProgressBar';

interface ReceiveFlowProps {
    onBack: () => void;
}

const ReceiveFlow: React.FC<ReceiveFlowProps> = ({ onBack }) => {
    // State for UI re-renders
    const [transferState, setTransferState] = useState<TransferState>(TransferState.Idle);
    const [answer, setAnswer] = useState<string>('');
    const [progress, setProgress] = useState(0);
    const [uiTotalReceivedBytes, setUiTotalReceivedBytes] = useState(0);
    const [uiTotalSize, setUiTotalSize] = useState(0);
    const [uiCurrentFileIndex, setUiCurrentFileIndex] = useState(0);
    const [uiFilesMetadata, setUiFilesMetadata] = useState<FileMetadata[]>([]);

    // Refs for stable access in callbacks, avoiding stale closures
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const receivedChunksRef = useRef<ArrayBuffer[]>([]);
    const filesMetadataRef = useRef<FileMetadata[]>([]);
    const totalSizeRef = useRef(0);
    const totalReceivedBytesRef = useRef(0);
    
    const resetState = useCallback(() => {
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        
        // Reset refs
        receivedChunksRef.current = [];
        filesMetadataRef.current = [];
        totalSizeRef.current = 0;
        totalReceivedBytesRef.current = 0;
        
        // Reset state
        setTransferState(TransferState.Idle);
        setAnswer('');
        setProgress(0);
        setUiFilesMetadata([]);
        setUiTotalReceivedBytes(0);
        setUiTotalSize(0);
        setUiCurrentFileIndex(0);
    }, []);

    const assembleAndDownloadFile = useCallback((metadata: FileMetadata) => {
        if (!metadata || receivedChunksRef.current.length === 0) return;
        const fileBlob = new Blob(receivedChunksRef.current, { type: metadata.type });
        const url = URL.createObjectURL(fileBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = metadata.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    }, []);

    const handleDataMessage = useCallback((event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
            receivedChunksRef.current.push(event.data);
            totalReceivedBytesRef.current += event.data.byteLength;
            
            setUiTotalReceivedBytes(totalReceivedBytesRef.current);
            if (totalSizeRef.current > 0) {
                setProgress((totalReceivedBytesRef.current / totalSizeRef.current) * 100);
            }
            return;
        }
        
        try {
            const message = JSON.parse(event.data) as ControlMessage;
            
            switch (message.type) {
                case 'batch-start':
                    setTransferState(TransferState.Transferring);
                    filesMetadataRef.current = message.files;
                    totalSizeRef.current = message.files.reduce((acc, file) => acc + file.size, 0);
                    totalReceivedBytesRef.current = 0; // Reset for the whole batch
                    
                    // Update UI
                    setUiFilesMetadata(message.files);
                    setUiTotalSize(totalSizeRef.current);
                    setUiCurrentFileIndex(0);
                    setUiTotalReceivedBytes(0);
                    receivedChunksRef.current = [];
                    break;
                
                case 'file-end':
                    const fileMeta = filesMetadataRef.current[message.index];
                    if (fileMeta) {
                        assembleAndDownloadFile(fileMeta);
                    }
                    receivedChunksRef.current = []; // Reset chunks for next file
                    setUiCurrentFileIndex(i => i + 1);
                    break;

                case 'batch-end':
                    setTransferState(TransferState.Completed);
                    break;
            }
        } catch (error) {
            console.error("Failed to handle control message:", error);
        }
    }, [assembleAndDownloadFile]);

    const handleOffer = async (offerPayload: string) => {
        if (!offerPayload || peerConnectionRef.current) return;
        try {
            setTransferState(TransferState.Connecting);
            const decodedOffer: SignalPayload = JSON.parse(atob(offerPayload));

            if (decodedOffer.type !== 'offer') {
                throw new Error('Invalid payload type');
            }

            const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
            peerConnectionRef.current = pc;
            
            pc.onicecandidate = (event) => {
                if (event.candidate === null) {
                    const answerPayload: SignalPayload = { type: 'answer', sdp: pc.localDescription! };
                    setAnswer(btoa(JSON.stringify(answerPayload)));
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
            
            pc.ondatachannel = (event) => {
                const dataChannel = event.channel;
                dataChannel.binaryType = 'arraybuffer';
                dataChannel.onmessage = handleDataMessage;
                dataChannel.onopen = () => console.log('Data channel opened by sender');
            };

            await pc.setRemoteDescription(new RTCSessionDescription(decodedOffer.sdp));
            const answerSdp = await pc.createAnswer();
            await pc.setLocalDescription(answerSdp);
            setTransferState(TransferState.AwaitingConnection);

        } catch (error) {
            console.error('Invalid offer or failed to create answer:', error);
            setTransferState(TransferState.Failed);
        }
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };
    
    const currentFileName = uiFilesMetadata.length > 0 && transferState === TransferState.Transferring ? uiFilesMetadata[uiCurrentFileIndex]?.name : '';

    return (
        <div className="bg-dark-card p-8 rounded-lg border border-dark-border shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-center">Receive File(s)</h2>

            {transferState === TransferState.Idle && (
                <div>
                    <p className="text-medium-text mb-2">1. Paste the sender's code here:</p>
                    <textarea 
                        placeholder="Paste sender's code..."
                        className="w-full p-2 bg-gray-800 border border-dark-border rounded-md text-sm h-24"
                        onChange={(e) => handleOffer(e.target.value)}
                    />
                </div>
            )}
            
            {transferState === TransferState.AwaitingConnection && (
                <div>
                    <p className="text-medium-text mb-2">2. Connection code generated. Copy and send this back to the sender:</p>
                    <div className="relative">
                        <textarea readOnly value={answer} className="w-full p-2 bg-gray-800 border border-dark-border rounded-md text-sm break-all h-24" />
                        <Button onClick={() => copyToClipboard(answer)} className="absolute top-2 right-2 text-xs">Copy</Button>
                    </div>
                    <p className="text-center mt-4 text-yellow-400">Waiting for sender to connect...</p>
                </div>
            )}
            
            {(transferState === TransferState.Connecting || transferState === TransferState.Connected) && <p className="text-center text-yellow-400">Establishing secure connection...</p>}

            {transferState === TransferState.Transferring && uiFilesMetadata.length > 0 && (
                <div>
                     <p className="text-center mb-2">Receiving file {uiCurrentFileIndex + 1} of {uiFilesMetadata.length}: <span className="font-bold">{currentFileName}</span></p>
                    <ProgressBar 
                        progress={progress}
                        currentBytes={uiTotalReceivedBytes}
                        totalBytes={uiTotalSize}
                        statusText="Overall Progress"
                    />
                </div>
            )}
            
            {transferState === TransferState.Completed && (
                <div className="text-center">
                    <p className="text-2xl font-bold text-green-400 mb-4">All Files Downloaded!</p>
                    <p className="text-medium-text mb-4">Your files have been saved to your downloads folder.</p>
                    <Button onClick={resetState}>Receive More Files</Button>
                </div>
            )}

            {transferState === TransferState.Failed && (
                 <div className="text-center">
                    <p className="text-2xl font-bold text-red-500 mb-4">Transfer Failed</p>
                    <p className="text-medium-text mb-4">Could not connect to peer. Please check the codes and try again.</p>
                    <Button onClick={resetState}>Try Again</Button>
                </div>
            )}

            <Button variant="secondary" onClick={onBack} className="mt-6 w-full">Back to Home</Button>
        </div>
    );
};

export default ReceiveFlow;