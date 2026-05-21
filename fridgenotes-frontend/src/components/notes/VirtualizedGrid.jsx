import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * VirtualizedGrid Component
 *
 * Renders only items that are visible in (or near) the viewport using
 * IntersectionObserver. Off-screen slots are replaced with a placeholder
 * div whose height matches `itemHeight`, keeping scroll position stable.
 */
const VirtualizedGrid = ({
  items,
  renderItem,
  itemHeight = 300,
  buffer = 2,
  className = '',
}) => {
  const [visibleIndices, setVisibleIndices] = useState(new Set());
  const containerRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: `${itemHeight * buffer}px`,
      threshold: 0,
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

  // Persist element references across renders so we can unobserve stale nodes
  // (e.g. when the list is reordered) without triggering unnecessary re-memos.
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
              const prev = elementsRef.current.get(index);
              if (prev !== el) {
                if (prev) observerRef.current?.unobserve(prev);
                observerRef.current?.observe(el);
                elementsRef.current.set(index, el);
              }
            } else {
              const prev = elementsRef.current.get(index);
              if (prev) observerRef.current?.unobserve(prev);
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
