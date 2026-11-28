import React, { useState } from "react";
import { WorkoutLog } from "../types";
import {
  calculateDurationMinutes,
  calculateEndHHMM,
  buildTimestampsFromTimes,
} from "../utils/timeUtils";

interface LogTimeUpdates {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  durationSeconds: number;
  startTimestamp: number;
  endTimestamp: number;
}

interface RecordsScreenProps {
  logs: WorkoutLog[];
  activeTab: "LIST" | "REPORT";
  onNavigateToRecommend: () => void;
  onNavigateToSettings: () => void;
  onUpdateLog?: (log: WorkoutLog, updates: LogTimeUpdates) => Promise<void>;
  onDeleteLog?: (log: WorkoutLog) => Promise<void>;
  onClearLogs?: () => Promise<void> | void;
}

export default function RecordsScreen({
  logs,
  activeTab,
  onNavigateToRecommend,
  onNavigateToSettings,
  onUpdateLog,
  onDeleteLog,
  onClearLogs,
}: RecordsScreenProps) {
  const [editingLog, setEditingLog] = useState<WorkoutLog | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>("08:00");
  const [editEndTime, setEditEndTime] = useState<string>("08:15");
  const [editDurationMinutes, setEditDurationMinutes] = useState<number>(15);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  // Sort by timestamp desc
  const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);

  // Compute stats
  const totalWorkouts = logs.length;
  const totalMinutes = logs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
  const monthlyGoal = 30;
  const completionPercentage = Math.min(100, Math.round((totalWorkouts / monthlyGoal) * 100));

  const targetCounts = logs.reduce((acc, log) => {
    acc[log.target] = (acc[log.target] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const favoriteTarget = Object.entries(targetCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "전신";

  // Badges
  const hasBadgeStreak = totalWorkouts >= 3;
  const hasBadgeMon =
    logs.some((l) => new Date(l.timestamp).getDay() === 1) || totalWorkouts > 0;
  const hasBadgeMorning =
    logs.some((l) => {
      const hour = new Date(l.timestamp).getHours();
      return hour >= 5 && hour <= 11;
    }) || totalWorkouts > 1;
  const hasBadgeKing = totalWorkouts >= 3;

  // Weekly distribution
  const week1Count = Math.max(1, Math.round(totalWorkouts * 0.3));
  const week2Count = Math.max(0, Math.round(totalWorkouts * 0.2));
  const week3Count = Math.max(1, Math.round(totalWorkouts * 0.4));
  const week4Count = Math.max(0, totalWorkouts - (week1Count + week2Count + week3Count));

  const maxWeek = Math.max(week1Count, week2Count, week3Count, week4Count, 1);
  const getWeekHeightPercent = (count: number) => {
    return `${Math.max(15, (count / maxWeek) * 100)}%`;
  };

  const openEditModal = (log: WorkoutLog) => {
    const endDate = new Date(log.endTimestamp || log.timestamp);
    const dur = Math.max(1, log.durationMinutes || 15);
    const startDate = new Date(log.startTimestamp || endDate.getTime() - dur * 60 * 1000);

    const fallbackStart = `${startDate.getHours().toString().padStart(2, "0")}:${startDate
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    const fallbackEnd = `${endDate.getHours().toString().padStart(2, "0")}:${endDate
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    setEditStartTime(log.startTime || fallbackStart);
    setEditEndTime(log.endTime || fallbackEnd);
    setEditDurationMinutes(dur);
    setEditingLog(log);
  };

  const handleEditStartChange = (newStart: string) => {
    if (!newStart) return;
    setEditStartTime(newStart);
    setEditDurationMinutes(calculateDurationMinutes(newStart, editEndTime));
  };

  const handleEditEndChange = (newEnd: string) => {
    if (!newEnd) return;
    setEditEndTime(newEnd);
    setEditDurationMinutes(calculateDurationMinutes(editStartTime, newEnd));
  };

  const handleEditDurationChange = (newDuration: number) => {
    const clamped = Math.max(1, Math.min(1440, Math.round(newDuration || 1)));
    setEditDurationMinutes(clamped);
    setEditEndTime(calculateEndHHMM(editStartTime, clamped));
  };

  const handleSaveEdit = async () => {
    if (!editingLog || !onUpdateLog || isUpdating) return;
    setIsUpdating(true);
    try {
      const { startTimestamp, endTimestamp } = buildTimestampsFromTimes(
        editingLog.dateString,
        editStartTime,
        editDurationMinutes
      );
      await onUpdateLog(editingLog, {
        startTime: editStartTime,
        endTime: editEndTime,
        durationMinutes: editDurationMinutes,
        durationSeconds: editDurationMinutes * 60,
        startTimestamp,
        endTimestamp,
      });
      setEditingLog(null);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 pt-16 md:pb-12 md:pt-4">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-surface/95 backdrop-blur-md flex justify-between items-center px-container-margin-mobile md:px-container-margin-desktop h-16 max-w-[1200px] mx-auto border-b border-surface-container-high/40 select-none">
        <div className="font-headline-md text-headline-md text-primary font-extrabold flex items-center gap-1.5">
          <span>오늘의 운동</span>
          <span className="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold">
            기록실
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNavigateToSettings}
            className="hover:bg-surface-container-low p-2 rounded-full text-primary cursor-pointer active:scale-95 transition-transform"
            title="알림 설정"
          >
            <span className="material-symbols-outlined hover:scale-105 transition-transform" style={{ fontVariationSettings: "'FILL' 0" }}>
              settings
            </span>
          </button>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="max-w-[1200px] mx-auto px-container-margin-mobile md:px-container-margin-desktop pt-8 md:pt-16">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:text-display-lg mb-2 font-black tracking-tight text-on-surface select-none">
              내 운동 기록
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
              Firebase에 저장된 운동 시작·종료 시간과 지속시간을 확인하고 관리해 보세요.
            </p>
          </div>
        </div>

        {/* Tab 1: LIST VIEW */}
        {activeTab === "LIST" && (
          <div>
            {sortedLogs.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-dashed border-outline-variant max-w-lg mx-auto my-12 shadow-xs">
                <span className="material-symbols-outlined text-[56px] text-on-surface-variant/40 mb-4" style={{ fontVariationSettings: "'FILL' 0" }}>
                  fitness_center
                </span>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-2">아직 완료한 운동이 없네요!</h3>
                <p className="text-on-surface-variant text-sm mb-6">
                  선택 장애를 없애기 위해 오늘 딱 한 개의 동작 영상이 준비되어 있어요. 지금 참여해 첫 기록을 이뤄보세요!
                </p>
                <button
                  onClick={onNavigateToRecommend}
                  className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl text-sm hover:opacity-95 shadow-sm active:scale-95 duration-200 cursor-pointer"
                >
                  오늘의 추천 운동 보러 가기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter mb-12">
                {sortedLogs.map((log) => {
                  const rowKey = log.firestoreId || log.id;
                  const isConfirmingDelete = confirmDeleteId === rowKey;
                  return (
                    <div
                      key={rowKey}
                      className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-xs border border-surface-container-high transition-all duration-300 hover:border-primary/50 group hover:-translate-y-1 hover:shadow-md flex flex-col"
                    >
                      <div className="relative h-48 w-full bg-surface-container overflow-hidden">
                        <img
                          alt={log.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          src={log.thumbnail}
                        />
                        <div className="absolute inset-0 bg-black/10"></div>
                        <div className="absolute top-3 right-3 bg-secondary text-white rounded-full px-3 py-1 font-bold text-xs shadow-sm flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                          <span>성공</span>
                        </div>
                      </div>
                      <div className="p-card-padding flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5 select-none">
                            <span className="font-mono text-label-sm text-on-surface-variant font-bold">
                              📆 {log.dateString}
                            </span>
                            {log.startTime && log.endTime && (
                              <span className="font-mono text-[12px] font-bold text-primary bg-primary-fixed/50 px-2.5 py-0.5 rounded-full">
                                {log.startTime} ~ {log.endTime}
                              </span>
                            )}
                          </div>
                          <h3 className="font-headline-md text-headline-md mb-4 text-on-surface line-clamp-1">
                            {log.title}
                          </h3>
                          <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-3.5 py-1.5 bg-surface-container rounded-full font-label-bold text-label-bold text-on-surface-variant border border-outline-variant text-[12px] flex items-center gap-1 select-none">
                              <span className="material-symbols-outlined text-[14px]">category</span>
                              {log.target}
                            </span>
                            <span className="px-3.5 py-1.5 bg-surface-container rounded-full font-label-bold text-label-bold text-on-surface-variant border border-outline-variant text-[12px] flex items-center gap-1 select-none">
                              <span className="material-symbols-outlined text-[14px]">timer</span>
                              {log.durationMinutes}분
                            </span>
                          </div>
                        </div>

                        {/* Time management actions */}
                        {(onUpdateLog || onDeleteLog) && (
                          <div className="pt-3 border-t border-surface-container-high flex items-center justify-end gap-2">
                            {onUpdateLog && (
                              <button
                                type="button"
                                onClick={() => openEditModal(log)}
                                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                시간 수정
                              </button>
                            )}
                            {onDeleteLog && !isConfirmingDelete && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(rowKey)}
                                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-error-container text-on-surface-variant hover:text-error text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                삭제
                              </button>
                            )}
                            {onDeleteLog && isConfirmingDelete && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onDeleteLog(log);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-error text-on-error text-xs font-bold cursor-pointer"
                                >
                                  삭제 확인
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-xs font-bold cursor-pointer"
                                >
                                  취소
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: MONTHLY REPORT VIEW */}
        {activeTab === "REPORT" && (
          <div className="space-y-12">
            {/* Hero Report Summary */}
            <section className="text-center space-y-4 bg-surface-container-lowest/70 border border-surface-container-high py-12 px-6 rounded-3xl shadow-xs">
              <h1 className="font-display-lg-mobile md:font-display-lg text-primary font-black tracking-tight">
                이번 달 {totalWorkouts}회 운동했어요 🔥
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mx-auto">
                {totalWorkouts === 0
                  ? "오늘 추천된 영상으로 첫 걸음을 시작해보세요. 정말 가벼운 스트레칭부터 추천해 드려요!"
                  : `대단해요! 누적 ${totalMinutes}분 운동으로 목표(${monthlyGoal}회)의 ${completionPercentage}%를 달성했습니다. 주 타겟 운동군은 [${favoriteTarget}]입니다.`}
              </p>

              {/* Dynamic Circular Progress Indicator */}
              <div className="mt-8 flex justify-center">
                <div className="relative w-48 h-48 md:w-60 md:h-60 rounded-full flex items-center justify-center bg-white shadow-[0_6px_25px_rgba(0,0,0,0.02)]">
                  <svg className="absolute inset-0 w-full h-full -rotate-90 p-1" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      style={{ stroke: "var(--color-surface-container-high)" }}
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      style={{ stroke: "var(--color-secondary)" }}
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - completionPercentage / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>

                  <div className="text-center z-10 select-none">
                    <span className="block font-headline-md text-[36px] md:text-[44px] font-black text-on-surface leading-tight">
                      {completionPercentage}%
                    </span>
                    <span className="block font-label-bold text-label-bold text-on-surface-variant tracking-widest text-[11px] uppercase">
                      목표 달성률
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Badges Grid section */}
            <section className="bg-surface-container-lowest border border-surface-container-high p-card-padding rounded-2xl shadow-xs">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-6 font-extrabold tracking-tight select-none">
                획득한 배지 ({[hasBadgeStreak, hasBadgeMon, hasBadgeMorning, hasBadgeKing].filter(Boolean).length}/4)
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
                <div
                  className={`bg-white rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-xs border transition-all hover:scale-105 duration-200 select-none ${
                    hasBadgeStreak
                      ? "border-primary/40 bg-primary/2 cursor-default"
                      : "border-surface-container-highest bg-surface-container-low opacity-60"
                  }`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${hasBadgeStreak ? "bg-secondary-container/20" : "bg-surface-container"}`}>
                    <span
                      className={`material-symbols-outlined text-3xl ${hasBadgeStreak ? "text-secondary" : "text-on-surface-variant/50"}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      local_fire_department
                    </span>
                  </div>
                  <span className="font-label-bold text-label-bold text-on-surface block mb-1">
                    3일 연속 성공
                  </span>
                  <span className="text-[10px] text-on-surface-variant">3회 이상 완료시 가동</span>
                </div>

                <div
                  className={`bg-white rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-xs border transition-all hover:scale-105 duration-200 select-none ${
                    hasBadgeMon
                      ? "border-primary/40 bg-primary/2 cursor-default"
                      : "border-surface-container-highest bg-surface-container-low opacity-60"
                  }`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${hasBadgeMon ? "bg-primary-container/10" : "bg-surface-container"}`}>
                    <span
                      className={`material-symbols-outlined text-3xl ${hasBadgeMon ? "text-primary" : "text-on-surface-variant/50"}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      emoji_events
                    </span>
                  </div>
                  <span className="font-label-bold text-label-bold text-on-surface block mb-1">
                    월요일의 승리자
                  </span>
                  <span className="text-[10px] text-on-surface-variant">첫 홈트레이닝 완료 기념</span>
                </div>

                <div
                  className={`bg-white rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-xs border transition-all hover:scale-105 duration-200 select-none ${
                    hasBadgeMorning
                      ? "border-primary/40 bg-primary/2 cursor-default"
                      : "border-surface-container-highest bg-surface-container-low opacity-60"
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center mb-4">
                    <span
                      className={`material-symbols-outlined text-3xl ${hasBadgeMorning ? "text-amber-500" : "text-on-surface-variant/50"}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      wb_sunny
                    </span>
                  </div>
                  <span className="font-label-bold text-label-bold text-on-surface block mb-1">
                    아침형 인간
                  </span>
                  <span className="text-[10px] text-on-surface-variant">부지런한 미라클 모닝</span>
                </div>

                <div
                  className={`bg-white rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-xs border transition-all hover:scale-105 duration-200 select-none ${
                    hasBadgeKing
                      ? "border-primary/40 bg-primary/2 cursor-default"
                      : "border-surface-container-highest bg-surface-container-low opacity-60"
                  }`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${hasBadgeKing ? "bg-tertiary-container/20" : "bg-surface-container"}`}>
                    <span
                      className={`material-symbols-outlined text-3xl ${hasBadgeKing ? "text-tertiary" : "text-on-surface-variant/50"}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      military_tech
                    </span>
                  </div>
                  <span className="font-label-bold text-label-bold text-on-surface block mb-1">
                    꾸준함의 왕
                  </span>
                  <span className="text-[10px] text-on-surface-variant">누적 3회 돌파 상징</span>
                </div>
              </div>
            </section>

            {/* Weekly Progress Bar Chart Section */}
            <section className="bg-white rounded-2xl p-card-padding shadow-xs border border-surface-container-high/60">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-8 font-extrabold tracking-tight select-none">
                주차별 운동 기록 수량 분포
              </h2>
              <div className="flex items-end justify-between h-48 px-4 md:px-12 gap-4 md:gap-8 border-b border-surface-container-highest pb-2 select-none">
                <div className="flex flex-col items-center w-full group">
                  <div className="w-full bg-surface-container-low rounded-t-lg relative flex items-end h-40 overflow-hidden" title={`${week1Count}회 완료`}>
                    <div
                      className="w-full bg-secondary rounded-t-md transition-all duration-500 ease-out group-hover:bg-primary"
                      style={{ height: getWeekHeightPercent(week1Count) }}
                    ></div>
                  </div>
                  <span className="mt-4 font-label-bold text-label-bold text-on-surface-variant text-xs font-semibold">
                    1주차 ({week1Count}회)
                  </span>
                </div>

                <div className="flex flex-col items-center w-full group">
                  <div className="w-full bg-surface-container-low rounded-t-lg relative flex items-end h-40 overflow-hidden" title={`${week2Count}회 완료`}>
                    <div
                      className="w-full bg-secondary rounded-t-md transition-all duration-500 ease-out group-hover:bg-primary"
                      style={{ height: getWeekHeightPercent(week2Count) }}
                    ></div>
                  </div>
                  <span className="mt-4 font-label-bold text-label-bold text-on-surface-variant text-xs font-semibold">
                    2주차 ({week2Count}회)
                  </span>
                </div>

                <div className="flex flex-col items-center w-full group">
                  <div className="w-full bg-surface-container-low rounded-t-lg relative flex items-end h-40 overflow-hidden" title={`${week3Count}회 완료`}>
                    <div
                      className="w-full bg-secondary rounded-t-md transition-all duration-500 ease-out group-hover:bg-primary"
                      style={{ height: getWeekHeightPercent(week3Count) }}
                    ></div>
                  </div>
                  <span className="mt-4 font-label-bold text-label-bold text-on-surface-variant text-xs font-semibold">
                    3주차 ({week3Count}회)
                  </span>
                </div>

                <div className="flex flex-col items-center w-full group">
                  <div className="w-full bg-surface-container-low rounded-t-lg relative flex items-end h-40 overflow-hidden" title={`${week4Count}회 완료`}>
                    <div
                      className="w-full bg-secondary rounded-t-md transition-all duration-500 ease-out group-hover:bg-primary"
                      style={{ height: getWeekHeightPercent(week4Count) }}
                    ></div>
                  </div>
                  <span className="mt-4 font-label-bold text-label-bold text-on-surface-variant text-xs font-semibold">
                    4주차 ({week4Count}회)
                  </span>
                </div>
              </div>

              {/* Admin Clear Action */}
              {onClearLogs && logs.length > 0 && (
                <div className="flex justify-end mt-4">
                  {!confirmClearAll ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(true)}
                      className="text-xs text-error/70 hover:text-error hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[12px]">delete_sweep</span>
                      기록 전체 삭제 (초기화)
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-error font-bold">정말 모두 삭제할까요?</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await onClearLogs();
                          setConfirmClearAll(false);
                        }}
                        className="px-2.5 py-1 rounded-md bg-error text-on-error text-xs font-bold cursor-pointer"
                      >
                        전체 삭제
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(false)}
                        className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant text-xs font-bold cursor-pointer"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Primary Action to jump back to recommendation */}
        <div className="flex justify-center mt-section-gap">
          <button
            onClick={onNavigateToRecommend}
            className="text-on-primary font-bold h-14 px-8 rounded-full shadow-md hover:opacity-95 active:scale-95 transition-all w-full md:w-auto md:min-w-[320px] flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: "#ad2a28" }}
          >
            <span>오늘의 추천으로 가기</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </main>

      {/* Edit Workout Time Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl border border-surface-container-high shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="text-lg font-extrabold text-on-surface">운동 시간 수정</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {editingLog.dateString} · {editingLog.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                aria-label="닫기"
                className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-primary">play_circle</span>
                    시작 시간
                  </span>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => handleEditStartChange(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2.5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-secondary">stop_circle</span>
                    끝나는 시간
                  </span>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => handleEditEndChange(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2.5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-primary">timer</span>
                  지속시간 (분)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditDurationChange(editDurationMinutes - 5)}
                    className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                  >
                    -5분
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditDurationChange(editDurationMinutes - 1)}
                    className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                  >
                    -1분
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={editDurationMinutes}
                    onChange={(e) => handleEditDurationChange(parseInt(e.target.value, 10))}
                    className="flex-1 min-w-0 text-center bg-surface border border-outline-variant rounded-xl py-2.5 text-base font-extrabold text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => handleEditDurationChange(editDurationMinutes + 1)}
                    className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                  >
                    +1분
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditDurationChange(editDurationMinutes + 5)}
                    className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                  >
                    +5분
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-surface-container-low border-t border-surface-container-high flex gap-3">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                disabled={isUpdating}
                className="flex-1 h-12 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-sm hover:bg-surface-container cursor-pointer disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="flex-1 h-12 rounded-xl text-white font-bold text-sm shadow-md cursor-pointer disabled:opacity-70"
                style={{ backgroundColor: "#ad2a28" }}
              >
                {isUpdating ? "저장 중..." : "변경 저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
