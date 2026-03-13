/**
 * 内置模板汇总导出
 *
 * 每个模板独立一个文件，新增模板只需：
 * 1. 在 sop/ 或 render/ 下新建文件
 * 2. 在此处 import 并加入对应数组
 */

// 类型导出
export type { BuiltinSopTemplate, BuiltinRenderTemplate } from './types';

// SOP 模板
import { sopResearch } from './sop/sop-research';
import { sopContent } from './sop/sop-content';
import { sopReport } from './sop/sop-report';
import { sopBugfix } from './sop/sop-bugfix';
import { sopAnalysis } from './sop/sop-analysis';

// 渲染模板
import { rtReportCard } from './render/rt-report-card';
import { rtWeekly } from './render/rt-weekly';
import { rtSocialCard } from './render/rt-social-card';
import { rtInsightPoster } from './render/rt-insight-poster';
import { rtTechSharing } from './render/rt-tech-sharing';
import { rtH5Sharing } from './render/rt-h5-sharing';
import { rtLandingPage } from './render/rt-landing-page';
import { rtNewspaper } from './render/rt-newspaper';
import { rtWechatModular } from './render/rt-wechat-modular';
import { rtNewspaperMobile } from './render/rt-newspaper-mobile';

export const BUILTIN_SOP_TEMPLATES = [
  sopResearch,
  sopContent,
  sopReport,
  sopBugfix,
  sopAnalysis,
];

export const BUILTIN_RENDER_TEMPLATES = [
  rtReportCard,
  rtWeekly,
  rtSocialCard,
  rtInsightPoster,
  rtTechSharing,
  rtH5Sharing,
  rtLandingPage,
  rtNewspaper,
  rtWechatModular,
  rtNewspaperMobile,
];
