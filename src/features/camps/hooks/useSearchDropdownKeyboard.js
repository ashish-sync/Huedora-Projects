import { useEffect, useRef, useState } from 'react';

export function useSearchDropdownKeyboard({
  open,
  itemCount,
  onSelectIndex,
  onClose,
  onOpen,
  resetDeps = [],
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemRefs = useRef([]);

  useEffect(() => {
    setActiveIndex(-1);
    itemRefs.current = [];
  }, [open, itemCount, ...resetDeps]);

  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  function setItemRef(index, node) {
    if (node) {
      itemRefs.current[index] = node;
    }
  }

  function getItemClassName(index, baseClassName = 'client-search-item') {
    return index === activeIndex
      ? `${baseClassName} is-active`
      : baseClassName;
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        onOpen?.();
        if (itemCount > 0) setActiveIndex(0);
        return;
      }
      if (itemCount > 0) {
        setActiveIndex((index) => (index < 0 ? 0 : Math.min(index + 1, itemCount - 1)));
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        onOpen?.();
        if (itemCount > 0) setActiveIndex(itemCount - 1);
        return;
      }
      if (itemCount > 0) {
        setActiveIndex((index) => (index < 0 ? itemCount - 1 : Math.max(index - 1, 0)));
      }
      return;
    }

    if (event.key === 'Enter') {
      if (!open || itemCount === 0) return;
      const selectedIndex = activeIndex >= 0 ? activeIndex : 0;
      event.preventDefault();
      onSelectIndex(selectedIndex);
      return;
    }

    if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      onClose?.();
    }
  }

  return {
    activeIndex,
    setActiveIndex,
    setItemRef,
    getItemClassName,
    handleKeyDown,
  };
}
