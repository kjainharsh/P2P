import React from 'react';

interface ProgressBarProps {
    progress: number;
    currentBytes?: number;
    totalBytes?: number;
    statusText?: string;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, currentBytes, totalBytes, statusText }) => {
    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
        <div>
            {statusText && (
                <div className="text-sm text-center text-medium-text mb-1">{statusText}</div>
            )}
            <div className="relative w-full bg-dark-border rounded-full h-4 my-2 overflow-hidden">
                <div
                    className="bg-gradient-to-r from-brand-primary to-brand-secondary h-4 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${clampedProgress}%` }}
                ></div>
                <span className="absolute w-full h-full top-0 left-0 flex items-center justify-center text-xs font-semibold text-white mix-blend-difference">
                    {clampedProgress.toFixed(0)}%
                </span>
            </div>
            {typeof currentBytes === 'number' && typeof totalBytes === 'number' && (
                 <div className="flex justify-between text-xs text-medium-text px-1">
                    <span>{formatBytes(currentBytes)} / {formatBytes(totalBytes)}</span>
                </div>
            )}
        </div>
    );
};

export default ProgressBar;