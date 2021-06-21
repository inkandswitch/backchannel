import { useEffect, useState } from 'react';

// Counts down the seconds starting from `durationSec` to 0.
export default function useCountdown(
  durationSec: number
): [timeRemaining: number, resetCountdown: () => void] {
  const [timeRemaining, setTimeRemaining] = useState<number>(durationSec);

  useEffect(() => {
    const timerID = setInterval(() => {
      if (timeRemaining !== 0) {
        // Count down by one second if the timer is not already at 0
        setTimeRemaining((sec) => sec - 1);
      }
    }, 1000);

    return () => clearInterval(timerID);
  }, [timeRemaining, durationSec]);

  return [timeRemaining, () => setTimeRemaining(durationSec)];
}
