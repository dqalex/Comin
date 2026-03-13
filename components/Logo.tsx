import React from 'react';

export const TeamClawLogo = ({ className = "w-8 h-8" }: { className?: string }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 1024 1024" 
      className={className}
      fill="none"
    >
      {/* 渐变定义 */}
      <defs>
        <linearGradient id="doneBg" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#7A2FF0" />
          <stop offset="100%" stopColor="#F4C2FF" />
        </linearGradient>
      </defs>

      {/* 三列背景模块 - 整体居中：X-53, Y+42 */}
      {/* To Do 深蓝色列 */}
      <rect x="53" y="222" width="200" height="580" rx="100" ry="100" fill="#0056ff"/>
      {/* Doing 浅灰色背景列 */}
      <rect x="309" y="222" width="200" height="580" rx="100" ry="100" fill="#E0E2E8"/>
      {/* Doing 中间深蓝色块 */}
      <rect x="309" y="362" width="200" height="300" rx="100" ry="100" fill="#0056ff"/>
      {/* Done 渐变列 */}
      <rect x="565" y="222" width="200" height="580" rx="100" ry="100" fill="url(#doneBg)"/>

      {/* 青色圆点 */}
      <circle cx="896" cy="297" r="75" fill="#00E0E9"/>
    </svg>
  );
};
