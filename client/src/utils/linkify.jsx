import React from 'react';

/**
 * Parses a string and wraps any HTTP/HTTPS URLs in a target="_blank" anchor tag.
 * @param {string} text - The input text containing optional URLs.
 * @returns {React.ReactNode} - React elements with clickable links.
 */
export const renderClickableLinks = (text) => {
    if (!text) return null;
    // Split text by URLs matching http/https pattern
    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, index) => {
        if (part.match(/^https?:\/\/[^\s]+/)) {
            return (
                <a 
                    key={index} 
                    href={part} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    onClick={(e) => e.stopPropagation()} 
                    style={{ 
                        color: 'var(--primary)', 
                        textDecoration: 'underline', 
                        wordBreak: 'break-all',
                        fontWeight: 600
                    }}
                >
                    {part}
                </a>
            );
        }
        return part;
    });
};
