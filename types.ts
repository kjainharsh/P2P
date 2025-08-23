export type AppView = 'home' | 'send' | 'receive';

export interface FileMetadata {
    name: string;
    size: number;
    type: string;
}

export interface SignalPayload {
    type: 'offer' | 'answer';
    sdp: RTCSessionDescriptionInit;
}

// Data Channel Message Types for multi-file transfer protocol
export type BatchStartPayload = {
    type: 'batch-start';
    files: FileMetadata[];
};

export type FileEndPayload = {
    type: 'file-end';
    index: number;
};

export type BatchEndPayload = {
    type: 'batch-end';
};

export type ControlMessage = BatchStartPayload | FileEndPayload | BatchEndPayload;


export enum TransferState {
    Idle = 'Idle',
    AwaitingConnection = 'AwaitingConnection',
    Connecting = 'Connecting',
    Connected = 'Connected',
    Transferring = 'Transferring',
    Completed = 'Completed',
    Failed = 'Failed',
    Closed = 'Closed',
}