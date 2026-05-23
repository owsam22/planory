import React from 'react';

export const SkeletonBase = ({ width, height, borderRadius, style, className = '' }) => {
    return (
        <div 
            className={`skeleton ${className}`} 
            style={{ 
                width: width || '100%', 
                height: height || '100%', 
                borderRadius: borderRadius || '4px',
                ...style 
            }} 
        />
    );
};

export const TaskSkeleton = () => {
    return (
        <div className="task-item task skeleton-loading-item" style={{ pointerEvents: 'none', borderLeft: '6px solid rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SkeletonBase width="24px" height="24px" borderRadius="50%" />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <SkeletonBase width="65%" height="1.1rem" borderRadius="6px" />
                <SkeletonBase width="35%" height="0.75rem" borderRadius="4px" />
                <SkeletonBase width="85%" height="0.8rem" borderRadius="4px" style={{ marginTop: '0.2rem' }} />
            </div>
            <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center' }}>
                <SkeletonBase width="16px" height="16px" borderRadius="4px" />
            </div>
        </div>
    );
};

export const EventSkeleton = () => {
    return (
        <div className="task-item event skeleton-loading-item" style={{ pointerEvents: 'none', borderLeft: '6px solid rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SkeletonBase width="24px" height="24px" borderRadius="6px" />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <SkeletonBase width="55%" height="1.1rem" borderRadius="6px" />
                <SkeletonBase width="40%" height="0.75rem" borderRadius="4px" />
                <SkeletonBase width="75%" height="0.8rem" borderRadius="4px" style={{ marginTop: '0.2rem' }} />
            </div>
        </div>
    );
};

export const NoteSkeleton = () => {
    return (
        <div className="glass-card note-card skeleton-loading-item" style={{ pointerEvents: 'none', minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'var(--glass)' }}>
            <SkeletonBase width="60%" height="1.2rem" borderRadius="6px" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <SkeletonBase width="95%" height="0.8rem" borderRadius="4px" />
                <SkeletonBase width="90%" height="0.8rem" borderRadius="4px" />
                <SkeletonBase width="50%" height="0.8rem" borderRadius="4px" />
            </div>
        </div>
    );
};

export default SkeletonBase;
