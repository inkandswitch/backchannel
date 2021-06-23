import { useEffect, useRef } from 'react';

export default function usePrevious<S>(value: S): S {
  // The ref object is a generic container whose current property is mutable and can hold any value, similar to an instance property on a class
  const ref = useRef(null);
  // Store current value in ref
  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
