import React, { useState, useEffect } from "react";
import { Workout, WorkoutTimeDetails } from "../types";
import {
  formatHHMM,
  formatDateYYYYMMDD,
  calculateDurationMinutes,
  calculateEndHHMM,
  buildTimestampsFromTimes,
} from "../utils/timeUtils";

interface PlaybackScreenProps {
  workout: Workout;
  onClose: () => void;
  onComplete: (details: WorkoutTimeDetails) => Promise<void> | void;
}

export default function PlaybackScreen({ workout, onClose, onComplete }: PlaybackScreenProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [elapsed, setElapsed] = useState<number>(0);

  // Time management modal state
  const [showCompleteModal, setShowCompleteModal] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string>("08:00");
  const [endTime, setEndTime] = useState<string>("08:15");
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [dateString, setDateString] = useState<string>(() => formatDateYYYYMMDD(new Date()));

  useEffect(() => {
    setElapsed(0);
    setIsPlaying(true);
  }, [workout]);

  // Handle timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= workout.durationSeconds) {
            if (interval) clearInterval(interval);
            setIsPlaying(false);
            return workout.durationSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, workout.durationSeconds]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRewind = () => {
    setElapsed((prev) => Math.max(0, prev - 10));
  };

  const handleForward = () => {
    setElapsed((prev) => Math.min(workout.durationSeconds, prev + 10));
  };

  const handleOpenCompleteModal = () => {
    setIsPlaying(false);
    const now = new Date();
    const initialDuration = Math.max(1, Math.round(elapsed / 60));
    const initialStart = new Date(now.getTime() - initialDuration * 60 * 1000);

    setDateString(formatDateYYYYMMDD(now));
    setEndTime(formatHHMM(now));
    setStartTime(formatHHMM(initialStart));
    setDurationMinutes(initialDuration);
    setShowCompleteModal(true);
  };

  const handleStartTimeChange = (newStart: string) => {
    if (!newStart) return;
    setStartTime(newStart);
    const nextDuration = calculateDurationMinutes(newStart, endTime);
    setDurationMinutes(nextDuration);
  };

  const handleEndTimeChange = (newEnd: string) => {
    if (!newEnd) return;
    setEndTime(newEnd);
    const nextDuration = calculateDurationMinutes(startTime, newEnd);
    setDurationMinutes(nextDuration);
  };

  const handleDurationChange = (newDuration: number) => {
    const clamped = Math.max(1, Math.min(1440, Math.round(newDuration || 1)));
    setDurationMinutes(clamped);
    setEndTime(calculateEndHHMM(startTime, clamped));
  };

  const handleConfirmSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { startTimestamp, endTimestamp } = buildTimestampsFromTimes(
        dateString,
        startTime,
        durationMinutes
      );
      await onComplete({
        startTime,
        endTime,
        durationMinutes,
        durationSeconds: durationMinutes * 60,
        startTimestamp,
        endTimestamp,
        dateString,
      });
      setShowCompleteModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const progressPercent = Math.min(100, Math.max(0, (elapsed / workout.durationSeconds) * 100));

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col pb-[120px]">
      {/* Mini App Bar */}
      <header className="bg-surface docked full-width top-0 z-50 flex justify-between items-center px-container-margin-mobile md:px-container-margin-desktop py-4 w-full max-w-[1200px] mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            aria-label="Back to recommend page"
            className="text-on-surface-variant hover:bg-surface-container/60 p-2 rounded-full transition-all active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
              close
            </span>
          </button>
          <h1 className="font-headline-md text-headline-md font-black text-primary select-none">
            오늘의 운동
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-primary-fixed text-primary px-2.5 py-1 rounded-full font-bold select-none">
            실시간 재생중 ⚡
          </span>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center w-full max-w-[1200px] mx-auto">
        {/* Video Player Section */}
        <section className="w-full relative bg-surface-container-highest md:rounded-3xl overflow-hidden shadow-[0_4px_25px_0_rgba(173,42,40,0.06)] border border-surface-container-high">
          <div className="aspect-video w-full relative">
            <img
              className="w-full h-full object-cover select-none"
              alt="High definition home gym setting"
              src={workout.thumbnailPlayback || workout.thumbnail}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none"></div>

            {!isPlaying && !showCompleteModal && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-xs transition-all pointer-events-none">
                <div className="bg-primary text-white font-bold px-6 py-3 rounded-full flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    pause
                  </span>
                  <span>운동 일시정지됨</span>
                </div>
              </div>
            )}

            <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2 text-white pointer-events-auto">
              <span className="bg-secondary text-on-secondary px-3 py-1 rounded-full font-bold text-xs inline-block w-max">
                {workout.difficultyDesc || `${workout.difficulty} 매운맛`}
              </span>
              <h2 className="font-headline-md text-headline-md text-white drop-shadow-md tracking-tight">
                {workout.title}
              </h2>
            </div>
          </div>
        </section>

        {/* Player Controls Section */}
        <section className="w-full px-container-margin-mobile md:px-container-margin-desktop py-8 flex flex-col items-center gap-8 mt-4">
          <div className="w-full max-w-2xl flex flex-col gap-2">
            <div className="flex justify-between font-label-sm text-label-sm text-tertiary select-none">
              <span className="font-mono font-bold tracking-wider">{formatTime(elapsed)}</span>
              <span className="font-mono">{formatTime(workout.durationSeconds)}</span>
            </div>

            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percent = Math.min(100, Math.max(0, clickX / rect.width));
                setElapsed(Math.floor(workout.durationSeconds * (percent / 100)));
              }}
              className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden cursor-pointer relative"
            >
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8">
            <button
              onClick={handleRewind}
              title="10초 뒤로 가기"
              className="w-14 h-14 rounded-full bg-surface-container-lowest shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] hover:shadow-md border border-surface-container-high hover:border-primary flex items-center justify-center text-on-surface hover:text-primary active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 0" }}>
                replay_10
              </span>
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? "일시정지" : "다시 재생"}
              className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg active:scale-95 hover:scale-105 transition-all hover:bg-opacity-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isPlaying ? "pause" : "play_arrow"}
              </span>
            </button>

            <button
              onClick={handleForward}
              title="10초 앞으로 가기"
              className="w-14 h-14 rounded-full bg-surface-container-lowest shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] hover:shadow-md border border-surface-container-high hover:border-primary flex items-center justify-center text-on-surface hover:text-primary active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 0" }}>
                forward_10
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* Fixed bottom action */}
      <div className="fixed bottom-0 left-0 w-full px-container-margin-mobile py-6 bg-gradient-to-t from-background via-background/90 to-transparent z-40">
        <div className="max-w-[1200px] mx-auto">
          <button
            onClick={handleOpenCompleteModal}
            disabled={isSaving}
            className="w-full h-[56px] text-[#fff] rounded-xl font-bold flex items-center justify-center shadow-lg active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#ad2a28" }}
          >
            오늘 운동 완료
          </button>
        </div>
      </div>

      {/* Workout Time Management Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl border border-surface-container-high shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="text-lg font-extrabold text-on-surface">운동 시간 기록 및 관리</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  시작·종료 시간과 지속시간을 확인하고 저장하세요
                </p>
              </div>
              <button
                onClick={() => setShowCompleteModal(false)}
                aria-label="닫기"
                className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Workout Summary */}
              <div className="bg-surface-container rounded-xl p-3.5 flex items-center justify-between border border-outline-variant/40">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-primary mb-0.5">{dateString} · {workout.target}</p>
                  <p className="text-sm font-bold text-on-surface truncate">{workout.title}</p>
                </div>
                <span className="shrink-0 bg-secondary/15 text-secondary text-xs font-bold px-3 py-1.5 rounded-lg">
                  총 {durationMinutes}분
                </span>
              </div>

              {/* Start & End Time Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-primary">play_circle</span>
                    운동 시작 시간
                  </span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2.5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-secondary">stop_circle</span>
                    운동 끝나는 시간
                  </span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2.5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </label>
              </div>

              {/* Duration Control */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-primary">timer</span>
                  운동 지속시간 (분)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDurationChange(durationMinutes - 5)}
                    className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container-high active:scale-95 cursor-pointer"
                  >
                    -5분
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDurationChange(durationMinutes - 1)}
                    className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container-high active:scale-95 cursor-pointer"
                  >
                    -1분
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={durationMinutes}
                    onChange={(e) => handleDurationChange(parseInt(e.target.value, 10))}
                    className="flex-1 min-w-0 text-center bg-surface border border-outline-variant rounded-xl py-2.5 text-base font-extrabold text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => handleDurationChange(durationMinutes + 1)}
                    className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container-high active:scale-95 cursor-pointer"
                  >
                    +1분
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDurationChange(durationMinutes + 5)}
                    className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container-high active:scale-95 cursor-pointer"
                  >
                    +5분
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant/80">
                  {startTime} ~ {endTime} ({durationMinutes}분)으로 Firebase 데이터베이스에 저장됩니다.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-surface-container-low border-t border-surface-container-high flex gap-3">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                disabled={isSaving}
                className="flex-1 h-12 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-sm hover:bg-surface-container cursor-pointer disabled:opacity-50"
              >
                계속 운동하기
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="flex-[1.4] h-12 rounded-xl text-white font-bold text-sm shadow-md active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-70"
                style={{ backgroundColor: "#ad2a28" }}
              >
                {isSaving ? "저장 중..." : "저장하고 메인으로"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
