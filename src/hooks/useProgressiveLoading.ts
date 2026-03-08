import { useState, useEffect, useCallback } from 'react';

export interface LoadingStage {
  name: string;
  loaded: boolean;
  duration?: number;
}

export interface ProgressiveLoadingOptions {
  onStageComplete?: (stageName: string, duration: number) => void;
  onAllComplete?: (totalDuration: number) => void;
}

export function useProgressiveLoading(options: ProgressiveLoadingOptions = {}) {
  const [stages, setStages] = useState<Record<string, LoadingStage>>({});
  const [isBasicDataLoaded, setIsBasicDataLoaded] = useState(false);
  const [isHeavyDataLoaded, setIsHeavyDataLoaded] = useState(false);
  const [totalLoadTime, setTotalLoadTime] = useState(0);
  const startTimeRef = useState(performance.now())[0];

  const markStageStart = useCallback((stageName: string) => {
    setStages(prev => ({
      ...prev,
      [stageName]: {
        name: stageName,
        loaded: false,
        duration: undefined,
      },
    }));
    return performance.now();
  }, []);

  const markStageComplete = useCallback((stageName: string, stageStartTime: number) => {
    const duration = performance.now() - stageStartTime;

    setStages(prev => ({
      ...prev,
      [stageName]: {
        name: stageName,
        loaded: true,
        duration,
      },
    }));

    console.log(`[Progressive Loading] ${stageName} completed in ${duration.toFixed(2)}ms`);

    if (options.onStageComplete) {
      options.onStageComplete(stageName, duration);
    }

    return duration;
  }, [options]);

  const markBasicDataLoaded = useCallback(() => {
    setIsBasicDataLoaded(true);
    const elapsed = performance.now() - startTimeRef;
    console.log(`[Progressive Loading] Basic data loaded in ${elapsed.toFixed(2)}ms`);
  }, [startTimeRef]);

  const markHeavyDataLoaded = useCallback(() => {
    setIsHeavyDataLoaded(true);
    const elapsed = performance.now() - startTimeRef;
    console.log(`[Progressive Loading] Heavy data loaded in ${elapsed.toFixed(2)}ms`);
  }, [startTimeRef]);

  const markAllComplete = useCallback(() => {
    const totalTime = performance.now() - startTimeRef;
    setTotalLoadTime(totalTime);
    console.log(`[Progressive Loading] All data loaded in ${totalTime.toFixed(2)}ms`);

    if (options.onAllComplete) {
      options.onAllComplete(totalTime);
    }
  }, [startTimeRef, options]);

  const isStageLoaded = useCallback((stageName: string) => {
    return stages[stageName]?.loaded || false;
  }, [stages]);

  const getStageDuration = useCallback((stageName: string) => {
    return stages[stageName]?.duration;
  }, [stages]);

  return {
    stages,
    isBasicDataLoaded,
    isHeavyDataLoaded,
    totalLoadTime,
    markStageStart,
    markStageComplete,
    markBasicDataLoaded,
    markHeavyDataLoaded,
    markAllComplete,
    isStageLoaded,
    getStageDuration,
  };
}
