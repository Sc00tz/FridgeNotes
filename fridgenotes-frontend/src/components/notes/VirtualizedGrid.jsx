import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * VirtualizedGrid Component
 * 
 * Implements a "windowing" technique to only render items that are visible
 * or near the viewport. This significantly improves performance when
 * displaying hundreds of notes.
 */
const VirtualizedGrid = ({
    items,
    renderItem,
    itemHeight = 300, // Estimated height of a NoteCard
    buffer = 2,      // Number of extra rows to render above/below
    className = ""
}) => {
    const [visibleIndices, setVisibleIndices] = useState(new Set());
    const containerRef = useRef(null);
    const observerRef = useRef(null);

    useEffect(() => {
        const observerOptions = {
            root: null, // use browser viewport
            rootMargin: `${itemHeight * buffer}px`,
            threshold: 0
        };

        const handleIntersect = (entries) => {
            setVisibleIndices(prev => {
                const newIndices = new Set(prev);
                entries.forEach(entry => {
                    const index = parseInt(entry.target.getAttribute('data-index'));
                    if (entry.isIntersecting) {
                        newIndices.add(index);
                    } else {
                        newIndices.delete(index);
                    }
                });
                return newIndices;
            });
        };

        observerRef.current = new IntersectionObserver(handleIntersect, observerOptions);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [itemHeight, buffer]);

    // Use a ref to store mapped elements to avoid unnecessary observer calls
    const elementsRef = useRef(new Map());

    const gridItems = useMemo(() => {
        return items.map((item, index) => {
            const isVisible = visibleIndices.has(index);

            return (
                <div
                    key={item.id || index}
                    data-index={index}
                    ref={(el) => {
                        if (el) {
                            if (!elementsRef.current.has(index)) {
                                observerRef.current?.observe(el);
                                elementsRef.current.set(index, el);
                            }
                        } else {
                            elementsRef.current.delete(index);
                        }
                    }}
                    style={{ minHeight: isVisible ? 'auto' : `${itemHeight}px` }}
                >
                    {isVisible ? renderItem(item, index) : <div className="w-full h-full bg-muted/20 animate-pulse rounded-lg" />}
                </div>
            );
        });
    }, [items, visibleIndices, renderItem, itemHeight]);

    return (
        <div ref={containerRef} className={className}>
            {gridItems}
        </div>
    );
};

export default VirtualizedGrid;
