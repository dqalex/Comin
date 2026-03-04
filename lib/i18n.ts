/**
 * 国际化配置 - 仅客户端
 */
'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useEffect, useState } from 'react';

const resources = {
  en: {
    translation: {
      app: { name: 'comind-v2', connecting: 'Connecting...', connected: 'Connected', disconnected: 'Disconnected', connect: 'Connect', disconnect: 'Disconnect' },
      nav: { dashboard: 'Dashboard', tasks: 'Tasks', scheduler: 'Scheduler', projects: 'Projects', members: 'Members', sessions: 'Sessions', skills: 'Skills', wiki: 'Wiki', deliveries: 'Deliveries', settings: 'Settings', agents: 'Agents', sop: 'SOP' },
      tasks: { title: 'Task Board', newTask: 'New Task', board: 'Board', list: 'List', todo: 'To Do', inProgress: 'In Progress', reviewing: 'Reviewing', completed: 'Completed', priority: 'Priority', high: 'High', medium: 'Medium', low: 'Low', deadline: 'Deadline', status: 'Status', noTasks: 'No tasks', assignee: 'Assignee', project: 'Project', delete: 'Delete', description: 'Description', checklist: 'Checklist', comments: 'Comments', logs: 'Logs', chatAbout: 'Chat about this', uncategorized: 'Uncategorized', unassigned: 'Unassigned', taskCount: 'tasks', quickCreatePlaceholder: 'Task title, press Enter to create...', titlePlaceholder: 'Task title...', openDetailForm: 'Open detail form', detail: 'Detail', dragHere: 'Drag tasks here', noTasksHint: 'No tasks. Click "New Task" to create.', deleteTask: 'Delete Task', deleteConfirm: 'Are you sure you want to delete this task?', synced: 'Synced', localTasks: 'Local', syncedTasks: 'Synced', selectedCount: '{{count}} selected', batchPush: 'Batch Push', pushing: 'Pushing...', selectAll: 'Select All', cancelSelection: 'Cancel' },
      scheduler: {
        title: 'Scheduler', newJob: 'New Job', status: 'Status', enabled: 'Enabled', disabled: 'Disabled', jobs: 'Jobs', nextWake: 'Next Wake', jobName: 'Job Name', schedule: 'Schedule', prompt: 'Prompt', cronHelp: 'Format: min hour day month week (e.g., 0 8 * * * = daily at 8:00)', create: 'Create', cancel: 'Cancel', runNow: 'Run Now', delete: 'Delete', noJobs: 'No scheduled tasks', noJobsHint: 'Create scheduled tasks to let AI execute automatically on schedule', sessionTarget: 'Session Target', wakeMode: 'Wake Mode', payload: 'Payload', delivery: 'Delivery', runHistory: 'Run History',
        totalJobs: 'Total Jobs', enabledJobs: 'Enabled', disabledJobs: 'Disabled', nextExecution: 'Next',
        todayTimeline: 'Today Timeline', lastRun: 'Last', nextRun: 'Next', disabledLabel: 'Disabled',
        wakeModeNow: 'Wake Now', wakeModeHeartbeat: 'Next Heartbeat', deliveryMode: 'Delivery Mode',
        noRunHistory: 'No run history', success: 'Success', failed: 'Failed', skipped: 'Skipped',
        consecutiveErrors: 'Consecutive failures {{count}}', duration: 'Duration',
        // Create/Edit form
        taskName: 'Task Name', taskNamePlaceholder: 'e.g., Daily Report Generation',
        execAgent: 'Exec Agent', defaultAgent: 'Default Agent', execAgentHint: 'Select the Agent to execute this scheduled task',
        scheduleMode: 'Schedule Mode', intervalMode: 'Interval', cronMode: 'Cron',
        seconds: 'seconds', timezone: 'Timezone (optional)', timezonePlaceholder: 'e.g., Asia/Shanghai',
        mainSession: 'main (main session)', isolatedSession: 'isolated (isolated session)',
        agentTurn: 'Agent Dialog', systemEvent: 'System Event',
        agentInstructions: 'Agent instructions...', systemContent: 'System event content...',
        insertDocRef: 'Insert document reference:', thinking: 'Thinking', timeout: 'Timeout',
        editTask: 'Edit Scheduled Task', deleteTask: 'Delete Scheduled Task', irreversible: 'This action cannot be undone',
        createdAt: 'Created At', linkedDocs: 'Linked Docs',
      },
      members: {
        title: 'Team Members', agent: 'Agent', status: 'Status', messages: 'Messages', idle: 'Idle', working: 'Working', waiting: 'Waiting', offline: 'Offline',
        addMember: 'Add Member', human: 'Human', ai: 'AI', delete: 'Delete', noMembers: 'No members', workingCount: '{{count}} AI working', idleCount: '{{count}} AI idle',
        aiMembers: 'AI Members', humanMembers: 'Human Members', noAiMembers: 'No AI Agents', noHumanMembers: 'No human members',
        connectGateway: 'Connect to Gateway to view AI members', goToDashboard: 'Go to Dashboard', goToAgentMgmt: 'Go to Agent Management',
        createAtAgentMgmt: 'Go to Agent Management to create', managedByGateway: 'AI members are managed by Gateway Agent',
        humanMember: 'Human Member', sessions: 'sessions', defaultAgent: 'Default', type: 'Type', name: 'Name',
        aiManagedHint: 'AI members are managed by Gateway Agent, click card or go to', agentMgmt: 'Agent Management', toOperate: 'to operate.',
        addDialogTitle: 'Add Member', addDialogAiHint: 'AI members are managed by Gateway Agent',
        addDialogAiHint2: 'Click button below to go to Agent Management page',
        goToAgentManagement: 'Go to Agent Management', memberName: 'Member Name',
        confirmDelete: 'Confirm Delete', irreversible: 'This action cannot be undone',
        // MCP Token 编辑
        editAiMember: 'Edit AI Member', mcpApiToken: 'MCP API Token', generateToken: 'Generate Token', copyToken: 'Copy Token', tokenCopied: 'Token copied',
        tokenDescription: 'Used for MCP External API authentication. OpenClaw Agent can use this token to call CoMind MCP tools.',
        noToken: 'No token set', hasToken: 'Token configured', tokenHidden: 'Token is hidden for security',
        gatewayConnectedHint: 'CoMind is connected to OpenClaw Gateway. OpenClaw Agent can automatically request MCP config via WebSocket.',
        gatewayNotConnectedHint: 'Connect to OpenClaw Gateway to enable automatic MCP config retrieval.',
        learnMore: 'Learn more', viewDocs: 'View Docs',
        // Quick Setup
        quickSetup: 'Quick Setup', quickSetupSuccess: 'Setup Tasks Created', quickSetupFailed: 'Quick setup failed',
        projectCreated: 'Project', tasksCreated: 'Tasks', tasksUnit: 'tasks',
        quickSetupHint: 'Tasks assigned to AI member. Check progress in Task Board.',
        viewTasks: 'View Tasks', quickSetupCreateHint: 'Auto-create member and setup',
        workspaceDir: 'Workspace Directory',
      },
      sessions: {
        title: 'Sessions', search: 'Search sessions', searchPlaceholder: 'Search session Key / Label / Channel...',
        kind: 'Kind', direct: 'Direct', group: 'Group', global: 'Global', unknown: 'Unknown', all: 'All',
        label: 'Label', thinking: 'Thinking', verbose: 'Verbose', reasoning: 'Reasoning', tokens: 'Tokens',
        delete: 'Delete', noSessions: 'No sessions', noMatchingSessions: 'No matching sessions',
        totalSessions: '{{count}} sessions', totalWithAll: '{{count}} sessions (total {{total}})',
        refresh: 'Refresh', sessionLabel: 'Session Label', noChange: 'No Change',
        editSession: 'Edit Session', deleteSession: 'Delete Session', irreversible: 'This action cannot be undone',
        edit: 'Edit', save: 'Save', cancel: 'Cancel', confirmDelete: 'Confirm Delete',
      },
      chat: { title: 'AI Chat', newChat: 'New Chat', sendMessage: 'Send message', all: 'All', noConversations: 'No conversations', startNew: 'Start a new conversation', aiReplyPending: 'AI reply integration pending' },
      skillsPage: {
        title: 'Skills Management', search: 'Search skills...', all: 'All', bundled: 'Bundled', external: 'External',
        refresh: 'Refresh', noMatchingSkills: 'No matching skills', unavailable: 'Unavailable',
        externalSkills: 'External Skills', bundledSkills: 'Bundled Skills',
        missingDeps: 'Missing Dependencies', requirements: 'Requirements', installOptions: 'Install Options',
        installing: 'Installing...', install: 'Install', source: 'Source', builtIn: 'Built-in',
        path: 'Path', skillKey: 'Skill Key',
      },
      agents: {
        title: 'Agent Management', overview: 'Overview', files: 'Files', tools: 'Tools', skills: 'Skills', channels: 'Channels', cron: 'Cron Jobs', sessionsTab: 'Sessions',
        noAgents: 'No agents', notConnected: 'Not connected to Gateway', refresh: 'Refresh', default: 'Default',
        newAgent: 'New Agent', sessions: 'sessions', selectAgent: 'Select an Agent to view details',
        deleteAgent: 'Delete Agent', deleteAgentDesc: 'This will also delete associated files. This action cannot be undone.',
        // Create Agent Dialog
        createAgentTitle: 'New Agent', name: 'Name', namePlaceholder: 'e.g., Assistant', workspacePath: 'Workspace Path',
        workspacePathPlaceholder: 'e.g., /path/to/workspace', emojiOptional: 'Emoji (Optional)', emojiPlaceholder: 'e.g., 🤖',
        // Overview Panel
        basicInfo: 'Basic Information', heartbeatConfig: 'Heartbeat Config', status: 'Status', enabled: 'Enabled', disabled: 'Disabled',
        interval: 'Interval', target: 'Target', model: 'Model', sessionInfo: 'Session Info', path: 'Path',
        // Skills Panel
        skillCount: 'Skills ({{count}})', searchSkills: 'Search skills...', install: 'Install', installNewSkill: 'Install New Skill',
        skillName: 'Skill Name', installId: 'Install ID', noMatchingSkills: 'No matching skills', unavailable: 'Unavailable',
        missing: 'Missing', builtIn: 'Built-in', extension: 'Extension', enable: 'Enable', disable: 'Disable',
        skillNamePlaceholder: 'e.g., web-search', installIdPlaceholder: 'e.g., npm:@anthropic/skill-web-search',
        heartbeatLabel: 'Heartbeat', loadConfigHint: 'to adjust tool profile.',
        // Channels Panel
        channelStatus: 'Channel Status ({{count}})', noChannelData: 'No channel data', connected: 'Connected', notLinked: 'Not Linked',
        notConfigured: 'Not Configured', linked: 'Linked',
        // Cron Panel
        agentCron: 'Agent Cron Jobs ({{count}})', allCron: 'All Cron Jobs ({{count}})', noCronJobs: 'No cron jobs', runNow: 'Run Now',
        lastRun: 'Last', nextRun: 'Next', every: 'Every {{sec}}s', scheduledAt: 'Scheduled {{at}}',
        // Files Panel
        workspaceFiles: 'Workspace Files ({{count}})', noFiles: 'No files', save: 'Save', edit: 'Edit',
        markdownContent: 'Markdown content...', fileReadError: '(Unable to read file)', selectFileToView: 'Select a file to view content',
        // Tools Panel
        toolPermissions: 'Tool Permissions', toolPermissionsDesc: 'Profile + single tool override config.', enabledCount: '{{count}}/{{total}} enabled',
        enableAll: 'Enable All', disableAll: 'Disable All', reloadConfig: 'Reload Config', saving: 'Saving...', saveConfig: 'Save',
        loadGatewayConfig: 'Load Gateway Config', agentAllowlistHint: 'This Agent uses explicit allowlist. Tool overrides are managed in Config tab.',
        globalAllowHint: 'Global tools.allow is set. Agent overrides cannot enable globally blocked tools.',
        preset: 'Preset', source: 'Source', unsaved: 'Unsaved', quickPreset: 'Quick Preset', inheritGlobal: 'Inherit Global',
        agentOverride: 'Agent Override', globalDefault: 'Global Default', systemDefault: 'System Default',
        // Sessions Panel
        agentSessions: 'Agent Sessions ({{count}})', allSessions: 'All Sessions ({{count}})', noSessions: 'No sessions',
      },
      connect: { title: 'Connect to OpenClaw Gateway', gatewayUrl: 'Gateway URL', token: 'Token', connectionFailed: 'Connection failed' },
      projects: {
        title: 'Projects', newProject: 'New Project', allProjects: 'All Projects', noProjects: 'No projects yet',
        noProjectsHint: 'Create a project to organize tasks and documents',
        projectName: 'Project Name', projectNamePlaceholder: 'Project name...',
        projectDesc: 'Project Description', projectDescPlaceholder: 'Project description (optional)...',
        noDesc: 'No description', tasks: 'tasks', docs: 'documents', completed: 'completed', synced: 'Synced',
        localProjects: 'Local', syncedProjects: 'Synced',
        deleteProject: 'Delete Project', deleteProjectHint: 'Related tasks and documents will not be deleted',
        // Patrol
        aiPatrol: 'AI Auto Patrol', aiPatrolling: 'AI Patrolling', aiPatrolPaused: 'AI Patrol Paused',
        enableAiPatrol: 'Enable AI Auto Patrol', enableAiPatrolHint: 'AI will periodically patrol project tasks and advance execution',
        patrolInterval: 'Patrol Interval', patrolAgent: 'Patrol Agent', defaultAgent: 'Default Agent',
        startPatrol: 'Start Patrol', deletePatrol: 'Delete Patrol Task', nextRun: 'Next',
      },
      deliveries: {
        title: 'Document Delivery Center', all: 'All', pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
        revisionNeeded: 'Revision Needed', unknown: 'Unknown', noDeliveries: 'No deliveries', noDeliveriesHint: 'Documents pushed by AI after completing tasks will appear here',
        pendingReview: '{{count}} pending review', allDeliveries: 'All Deliveries',
        needModifyReturn: 'Need Modify / Returned', externalDoc: 'External Document', localDoc: 'Local Document',
        platform: { tencentDoc: 'Tencent Doc', feishu: 'Feishu Doc', notion: 'Notion', local: 'Local Doc', external: 'External Doc' },
        reviewDoc: 'Review Document', docTitle: 'Document Title', linkedDoc: 'Linked Document', externalLink: 'External Link',
        reviewComment: 'Review Comment (Optional)', reviewCommentPlaceholder: 'Enter review comment...',
        needModify: 'Need Modify', return: 'Return', pass: 'Pass', reviewer: 'Reviewer', unknownAi: 'Unknown AI',
        openDoc: 'Open Document', synced: 'Synced',
        uncategorized: 'Uncategorized', deliveryCount: 'deliveries', linkedTask: 'Task', linkedProject: 'Project',
        assignee: 'Assignee', reReview: 'Re-review', reviewResult: 'Review Result', submitReview: 'Submit Review',
      },
      common: { create: 'Create', cancel: 'Cancel', save: 'Save', delete: 'Delete', edit: 'Edit', editMode: 'Edit Mode', confirm: 'Confirm', back: 'Back', close: 'Close', search: 'Search', noData: 'No data', loading: 'Loading...', all: 'All', success: 'Success' },
      errors: {
        notFound: 'Resource not found',
        invalidInput: 'Invalid input',
        unauthorized: 'Unauthorized',
        forbidden: 'Access denied',
        internalError: 'Internal server error',
        taskNotFound: 'Task not found',
        memberNotFound: 'Member not found',
        projectNotFound: 'Project not found',
        documentNotFound: 'Document not found',
        deliveryNotFound: 'Delivery not found',
        milestoneNotFound: 'Milestone not found',
        titleRequired: 'Title is required',
        memberIdRequired: 'Member ID is required',
        platformRequired: 'Platform is required',
        invalidStatus: 'Invalid status value',
        invalidPriority: 'Invalid priority value',
        invalidPlatform: 'Invalid platform value',
        createFailed: 'Failed to create',
        updateFailed: 'Failed to update',
        deleteFailed: 'Failed to delete',
        fetchFailed: 'Failed to fetch data',
        localDocRequiresDocId: 'Local document delivery requires a document ID',
        externalDocRequiresUrl: 'External document delivery requires a URL',
        workspaceNotFound: 'Workspace not found',
        workspacePathNotExist: 'Workspace path does not exist',
        syncFailed: 'Sync failed',
      },
      errorBoundary: { networkError: 'Network Error', pageError: 'Page Error', networkHint: 'Please check your network connection and retry.', pageHint: 'Sorry, the page encountered an error. Please try refreshing or go back to home.', details: 'Error Details', retry: 'Retry', goHome: 'Go Home' },
      dashboard: {
        title: 'Dashboard',
        connected: 'Connected', refresh: 'Refresh', disconnectBtn: 'Disconnect',
        address: 'Address', tokenOptional: 'Token (Optional)', authToken: 'Auth Token',
        connecting: 'Connecting...', connectBtn: 'Connect',
        status: 'Status', uptime: 'Uptime', tickInterval: 'Tick Interval', channelRefresh: 'Channel Refresh',
        onlineInstances: 'Online instances', activeSessions: 'Active sessions',
        authMode: 'Auth Mode', heartbeatInterval: 'Heartbeat Interval',
        channelStatus: 'Channel Status', configuredLinked: 'Connected', configuredNotLinked: 'Not Linked', notConfigured: 'Not Configured',
        agentStatus: 'Agent Status', defaultLabel: 'Default',
        sessions: 'sessions', heartbeat: 'Heartbeat', off: 'Off',
        quickAccess: 'Quick Access',
        aiMemberStatus: 'AI Member Status', working: 'Working', idle: 'Idle',
        currentTask: 'Current task',
        projectOverview: 'Project Overview', completed: 'completed',
        justNow: 'just now',
        secondsAgo: '{{count}}s ago', minutesAgo: '{{count}}m ago', hoursAgo: '{{count}}h ago', daysAgo: '{{count}}d ago',
        secondsLater: '{{count}}s later', minutesLater: '{{count}}m later', hoursLater: '{{count}}h later',
        enabled: 'Enabled', disabled: 'Disabled',
        tasks: '{{count}} tasks', nextRun: 'Next: {{time}}', enabledOfTotal: '{{enabled}}/{{total}} enabled',
      },
      openclaw: {
        title: 'OpenClaw Workspace', desc: 'Sync local Markdown files with CoMind',
        backToSettings: 'Back to Settings', refresh: 'Refresh', add: 'Add',
        noWorkspace: 'No Workspace', noWorkspaceHint: 'Add a local directory to start syncing Markdown files',
        createFirst: 'Create first Workspace',
        // Workspace Card
        sync: 'Sync', watch: 'Watch', lastSync: 'Last sync', error: 'Error',
        scan: 'Scan', default: 'Default',
        // Workspace Form
        createWorkspace: 'Create Workspace', editWorkspace: 'Edit Workspace',
        nameLabel: 'Name', namePlaceholder: 'My Workspace', nameRequired: 'Name is required',
        pathLabel: 'Path', pathPlaceholder: '~/.openclaw/workspace', pathRequired: 'Path is required',
        pathHint: 'Absolute path to the directory containing Markdown files',
        enableSync: 'Enable Sync', enableWatch: 'Real-time Watch',
        setDefault: 'Set as Default', syncInterval: 'Auto Sync Interval (minutes)',
        syncIntervalHint: 'Periodic full sync interval. Runs alongside real-time watch.',
        syncIntervalRange: '1-1440 min, default 30',
        excludePatterns: 'Exclude Patterns (one per line)',
        excludePlaceholder: 'node_modules/**\n.git/**\ntemp/**',
        cancel: 'Cancel', save: 'Save', create: 'Create',
        // Status
        statusIdle: 'Idle', statusSyncing: 'Syncing', statusError: 'Error',
        // Binding
        notBound: 'Not bound to AI member. Bind in edit form to enable heartbeat tasks.',
        bindMember: 'Bind AI Member', noneSelected: 'None (not bound)',
      },
      wiki: {
        title: 'Documents', search: 'Search documents...', newDoc: 'New Document', noDocs: 'No documents',
        type: 'Type', source: 'Source', local: 'Local', external: 'External', openclaw: 'Synced', titleLabel: 'Title',
        // Document types
        report: 'Report', note: 'Note', decision: 'Decision', scheduledTask: 'Scheduled Task', taskList: 'Task List', other: 'Other', all: 'All', guide: 'Guide', reference: 'Reference',
        // Meta
        clickToLinkProject: 'Click to link project', linkedProjects: 'Linked Projects', notLinked: 'Not linked to any project',
        primaryProject: 'Primary', unknownProject: 'Unknown',
        // Knowledge graph
        relations: 'Relations', projectCount: 'Projects', memberCount: 'Members', refs: 'References', backrefs: 'Back References',
        noMembers: 'None (use @memberName)', noRefs: 'None (use [[title]])',
        // Create dialog
        createDocTitle: 'New Document', docTitle: 'Title', docTitlePlaceholder: 'Document title...',
        docType: 'Document Type', willAutoFill: 'Will auto-fill "{{type}}" template',
        linkProjects: 'Link Projects (multi-select)', noProjects: 'No projects',
        // Delete dialog
        confirmDelete: 'Confirm Delete', deleteWarning: 'This action cannot be undone',
        // Editor
        selectToEdit: 'Select a document to start editing', startWriting: 'Start writing...',
        openExternal: 'Open',
        // Share link
        share: 'Share', shareLink: 'Share Link', copyLink: 'Copy Link', linkCopied: 'Link copied!', copyFailed: 'Copy failed',
        // OpenClaw edit
        conflictError: 'File has been modified by another program, please refresh and try again',
        chatWithAI: 'Chat with AI',
        // Render template
        renderTemplate: 'Template', changeTemplate: 'Change Template', noTemplate: 'No Template', removeTemplate: 'Remove Template',
        templateLocked: 'Template cannot be changed after binding (different templates have incompatible slot definitions)',
      },
      milestones: {
        title: 'Milestones', milestone: 'Milestone', noMilestones: 'No milestones',
        noMilestonesHint: 'Create milestones to divide project phases',
        createMilestone: 'New Milestone', editMilestone: 'Edit Milestone', deleteMilestone: 'Delete Milestone',
        milestoneName: 'Milestone Name', milestoneNamePlaceholder: 'Milestone name...',
        milestoneDesc: 'Description', milestoneDescPlaceholder: 'Milestone description (optional)...',
        dueDate: 'Due Date', sortOrder: 'Sort Order', status: 'Status',
        open: 'Open', inProgress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
        deleteConfirm: 'Are you sure you want to delete this milestone? Related tasks will be unlinked.',
        unassigned: 'No Milestone', milestoneCount: 'milestones',
        completedCount: '{{completed}}/{{total}} completed',
      },
      sop: {
        title: 'SOP Templates', subtitle: 'Workflow Templates',
        newTemplate: 'New Template', search: 'Search templates...',
        all: 'All', content: 'Content', analysis: 'Analysis', research: 'Research',
        development: 'Development', operations: 'Operations', media: 'Media', custom: 'Custom',
        // Status
        status: 'Status', draft: 'Draft', active: 'Active', archived: 'Archived',
        // Template card
        stages: 'stages', noTemplates: 'No SOP templates',
        noTemplatesHint: 'Create templates to standardize AI workflows',
        builtin: 'Built-in', global: 'Global',
        // Detail
        templateName: 'Template Name', templateNamePlaceholder: 'Template name...',
        description: 'Description', descriptionPlaceholder: 'Describe the template purpose...',
        category: 'Category', selectCategory: 'Select category',
        icon: 'Icon', iconPlaceholder: 'e.g., clipboard-list',
        // Stages
        stagesTitle: 'Stages', addStage: 'Add Stage', noStages: 'No stages defined',
        stageLabel: 'Stage Label', stageLabelPlaceholder: 'e.g., Data Collection',
        stageDesc: 'Stage Description', stageDescPlaceholder: 'Describe what this stage does...',
        stageType: 'Stage Type',
        stageTypeInput: 'Input', stageTypeAiAuto: 'AI Auto', stageTypeAiConfirm: 'AI + Confirm',
        stageTypeManual: 'Manual', stageTypeRender: 'Render', stageTypeExport: 'Export', stageTypeReview: 'Review',
        promptTemplate: 'Prompt Template', promptTemplatePlaceholder: 'AI instructions for this stage...',
        outputType: 'Output Type', outputLabel: 'Output Label',
        // AI Config
        aiConfig: 'AI Configuration', requiredTools: 'Required Tools',
        systemPrompt: 'System Prompt', systemPromptPlaceholder: 'Global AI instructions...',
        // Quality
        qualityChecklist: 'Quality Checklist', addCheckItem: 'Add check item',
        // Actions
        createTemplate: 'Create Template', editTemplate: 'Edit Template',
        deleteTemplate: 'Delete Template', deleteConfirm: 'Are you sure you want to delete this template?',
        cannotDelete: 'Cannot delete: template is being used by tasks',
        save: 'Save', cancel: 'Cancel',
        // Linked
        linkedProject: 'Linked Project', noProject: 'Global (all projects)',
        tasksUsing: '{{count}} tasks using',
        // Stage drag
        dragToReorder: 'Drag to reorder',
        // Progress (B4)
        progress: 'SOP Progress', currentStage: 'Current Stage',
        stageProgress: '{{current}}/{{total}} {{label}}',
        stagePending: 'Pending', stageActive: 'In Progress',
        stageWaitingInput: 'Waiting Input', stageWaitingConfirm: 'Waiting Confirm',
        stageCompleted: 'Completed', stageSkipped: 'Skipped', stageFailed: 'Failed',
        noSopBound: 'No SOP template bound',
        // Confirm actions (B5)
        confirmStage: 'Confirm', rejectStage: 'Reject', skipStage: 'Skip',
        advanceStage: 'Advance', confirmAdvance: 'Confirm and advance to next stage?',
        confirmReject: 'Reject and rollback?', stageOutput: 'Stage Output',
        // Know-how (D1-D3)
        knowledgeConfig: 'Knowledge Base', selectKnowledgeDoc: 'Select knowledge document',
        noKnowledgeDoc: 'No knowledge base configured',
        knowledgeLayers: 'Knowledge Layers', layerL1: 'L1 Core Rules',
        layerL2: 'L2 Detailed Standards', layerL3: 'L3 Case Library',
        layerL4: 'L4 Experience Log', layerL5: 'L5 Maintenance Log',
        knowledgeHint: 'Knowledge is auto-loaded based on stage layer config during SOP execution',
        // Import/Export (D5)
        importTemplate: 'Import Template', exportTemplate: 'Export Template',
        importSuccess: 'Template imported (draft status), please activate after review',
        importError: 'Import failed: invalid format',
        exportSuccess: 'Template exported',
        // Input stage
        submitInput: 'Submit', inputRequired: 'Required',
        // Debug
        debugTitle: 'SOP Debug', debugTaskId: 'Task ID', debugTemplate: 'Template',
        debugCurrentStage: 'Current Stage', debugStageHistory: 'Stage History',
        debugSopInputs: 'SOP Inputs', debugNoSopTasks: 'No SOP tasks found',
        debugRefresh: 'Refresh', debugStageOutput: 'Output',
        // Render templates tab
        renderTemplatesTab: 'Render Templates',
      },
      renderTemplate: {
        title: 'Render Templates', subtitle: 'Visual Templates',
        report: 'Report', card: 'Card', poster: 'Poster', presentation: 'Presentation', custom: 'Custom',
        noTemplates: 'No render templates', noTemplatesHint: 'Create templates for document visualization',
        slots: 'slots',
        previewTab: 'Preview', codeTab: 'Code', slotsTab: 'Slots',
        aiCreate: 'AI Create', aiCreateHint: 'Describe the template you want, AI will create it for you',
        aiCreatePlaceholder: 'Describe the visual template you need, e.g.: a blue gradient tech-style data dashboard card with 3 metric areas + summary section...',
        aiCreateSending: 'Sending to AI...',
        aiCreateSent: 'Request sent, AI is working on it',
      },
      studio: {
        preview: 'Preview', edit: 'Edit', fitToWindow: 'Fit to Window', noContent: 'No content to preview',
        selectElement: 'Click an element in the preview to edit its properties',
        fontSize: 'Font Size', fontWeight: 'Font Weight', textColor: 'Text Color',
        backgroundColor: 'Background', textAlign: 'Text Align',
        letterSpacing: 'Letter Spacing', lineHeight: 'Line Height',
        imageUrl: 'Image URL', replace: 'Replace', currentContent: 'Current Content',
        properties: 'Properties',
        export: 'Export', exportFormat: 'Format', exportScale: 'Scale',
        exportResolution: 'Resolution', exportWidth: 'Width (px)',
        exportNow: 'Export Now',
        exportCleaningHtml: 'Cleaning HTML...', exportPreparingFrame: 'Preparing export frame...',
        exportWaitingResources: 'Waiting for resources...', exportGeneratingImage: 'Generating image...',
        exportFailed: 'Export failed, please try again',
        visualMode: 'Visual', renderTemplate: 'Render Template',
        noTemplate: 'No template', templateHint: 'Select a render template for visual editing',
        openInStudio: 'Open in Content Studio', renderStageHint: 'This render stage requires visual editing',
        templatePreview: 'Template Preview', templateWithExample: 'Template will auto-fill example content',
        templateVisual: 'Template Visual', templateVisualShort: 'Visual',
        visualEdit: 'Visual Edit', propertyPanel: 'Property Panel',
      },
      sopEditor: {
        mdEditMode: 'Markdown Edit', formEditMode: 'Form Edit',
        importSkill: 'Import Skill', importSkillHint: 'Import an existing Skill YAML+Markdown file as SOP template',
        importSkillPlaceholder: 'Paste Skill Markdown content here (supports --- frontmatter --- syntax)...',
        parseSkill: 'Parse & Import', parseSuccess: 'Skill parsed successfully',
        parseError: 'Parse failed: invalid Skill format',
        mdPlaceholder: '# Template Name\n\nEnter SOP template content in Markdown...\n\n## Stage 1: Data Collection\n- type: ai_auto\n- prompt: ...\n\n## Stage 2: Analysis\n- type: ai_with_confirm',
      },
    },
  },
  zh: {
    translation: {
      app: { name: 'comind-v2', connecting: '连接中...', connected: '已连接', disconnected: '未连接', connect: '连接', disconnect: '断开' },
      nav: { dashboard: '工作台', tasks: '任务', scheduler: '定时任务', projects: '项目', members: '成员', sessions: '会话', skills: '技能', wiki: '文档', deliveries: '交付', settings: '设置', agents: 'Agent 管理', sop: 'SOP 模板' },
      tasks: { title: '任务看板', newTask: '新建任务', board: '看板', list: '列表', todo: '待办', inProgress: '进行中', reviewing: '审核中', completed: '已完成', priority: '优先级', high: '高', medium: '中', low: '低', deadline: '截止日期', status: '状态', noTasks: '暂无任务', assignee: '负责人', project: '项目', delete: '删除', description: '描述', checklist: '检查项', comments: '评论', logs: '日志', chatAbout: '与 AI 讨论', uncategorized: '未分类', unassigned: '未指定', taskCount: '个任务', quickCreatePlaceholder: '输入任务标题，按 Enter 创建...', titlePlaceholder: '任务标题...', openDetailForm: '打开详细表单', detail: '详细', dragHere: '拖拽任务到此处', noTasksHint: '暂无任务，点击"新建任务"创建', deleteTask: '删除任务', deleteConfirm: '确定要删除这个任务吗？', synced: '同步', localTasks: '本地', syncedTasks: '同步', selectedCount: '已选择 {{count}} 个任务', batchPush: '批量推送', pushing: '推送中...', selectAll: '全选', cancelSelection: '取消' },
      scheduler: {
        title: '定时任务', newJob: '新建任务', status: '状态', enabled: '已启用', disabled: '已禁用', jobs: '任务数量', nextWake: '下次唤醒', jobName: '任务名称', schedule: '调度', prompt: '执行指令', cronHelp: '格式: 分 时 日 月 周 (例如: 0 8 * * * = 每天 8:00)', create: '创建', cancel: '取消', runNow: '立即执行', delete: '删除', noJobs: '暂无定时任务', noJobsHint: '创建定时任务让 AI 按计划自动执行', sessionTarget: 'Session 目标', wakeMode: 'Wake 模式', payload: 'Payload', delivery: '投递模式', runHistory: '执行历史',
        totalJobs: '总任务', enabledJobs: '已启用', disabledJobs: '已禁用', nextExecution: '下次执行',
        todayTimeline: '今日时间线', lastRun: '上次', nextRun: '下次', disabledLabel: '已禁用',
        wakeModeNow: '立即唤醒', wakeModeHeartbeat: '下次心跳', deliveryMode: '投递模式',
        noRunHistory: '暂无执行记录', success: '成功', failed: '失败', skipped: '跳过',
        consecutiveErrors: '连续失败 {{count}} 次', duration: '耗时',
        // Create/Edit form
        taskName: '任务名称', taskNamePlaceholder: '例：每日晨报生成',
        execAgent: '执行 Agent', defaultAgent: '默认 Agent', execAgentHint: '选择执行此定时任务的 Agent',
        scheduleMode: '调度模式', intervalMode: '间隔', cronMode: 'Cron',
        seconds: '秒', timezone: '时区（可选）', timezonePlaceholder: '例：Asia/Shanghai',
        mainSession: 'main (主会话)', isolatedSession: 'isolated (隔离会话)',
        agentTurn: 'Agent 对话', systemEvent: '系统事件',
        agentInstructions: 'Agent 执行指令...', systemContent: '系统事件内容...',
        insertDocRef: '插入文档引用:', thinking: 'Thinking', timeout: '超时',
        editTask: '编辑定时任务', deleteTask: '删除定时任务', irreversible: '此操作不可撤销',
        createdAt: '创建时间', linkedDocs: '关联文档',
      },
      members: {
        title: '团队成员', agent: 'Agent', status: '状态', messages: '消息数', idle: '空闲', working: '工作中', waiting: '等待中', offline: '离线',
        addMember: '添加成员', human: '人类', ai: 'AI', delete: '删除', noMembers: '暂无成员', workingCount: '{{count}} 个 AI 工作中', idleCount: '{{count}} 个 AI 空闲',
        aiMembers: 'AI 成员', humanMembers: '人类成员', noAiMembers: '暂无 AI Agent', noHumanMembers: '暂无人类成员',
        connectGateway: '请先在工作台连接 Gateway 以查看 AI 成员', goToDashboard: '前往工作台连接', goToAgentMgmt: '前往 Agent 管理',
        createAtAgentMgmt: '前往 Agent 管理创建', managedByGateway: 'AI 成员由 Gateway Agent 管理',
        humanMember: '人类成员', sessions: '会话', defaultAgent: '默认', type: '类型', name: '名称',
        aiManagedHint: 'AI 成员由 Gateway Agent 管理，点击卡片或前往', agentMgmt: 'Agent 管理', toOperate: '进行操作。',
        addDialogTitle: '添加成员', addDialogAiHint: 'AI 成员由 Gateway Agent 管理',
        addDialogAiHint2: '点击下方按钮前往 Agent 管理页面创建',
        goToAgentManagement: '前往 Agent 管理', memberName: '成员名称',
        confirmDelete: '确认删除', irreversible: '此操作不可撤销',
        // MCP Token 编辑
        editAiMember: '编辑 AI 成员', mcpApiToken: 'MCP API Token', generateToken: '生成 Token', copyToken: '复制 Token', tokenCopied: 'Token 已复制',
        tokenDescription: '用于 MCP External API 鉴权。OpenClaw Agent 可使用此 Token 调用 CoMind MCP 工具。',
        noToken: '未设置 Token', hasToken: '已配置 Token', tokenHidden: 'Token 已隐藏保护',
        gatewayConnectedHint: 'CoMind 已连接 OpenClaw Gateway，OpenClaw Agent 可通过 WebSocket 自动请求 MCP 配置。',
        gatewayNotConnectedHint: '连接 OpenClaw Gateway 后可启用自动 MCP 配置获取。',
        learnMore: '了解更多', viewDocs: '查看文档',
        // 一键配置
        quickSetup: '一键配置', quickSetupSuccess: '已创建联调任务', quickSetupFailed: '一键配置失败',
        projectCreated: '项目', tasksCreated: '任务', tasksUnit: '个',
        quickSetupHint: '任务已分配给 AI 成员，请前往任务面板查看执行进度。',
        viewTasks: '查看任务', quickSetupCreateHint: '自动创建成员并配置',
        workspaceDir: '工作区目录',
      },
      sessions: {
        title: '会话管理', search: '搜索会话', searchPlaceholder: '搜索会话 Key / 标签 / 频道...',
        kind: '类型', direct: '直连', group: '群组', global: '全局', unknown: '未知', all: '全部',
        label: '标签', thinking: '思考级别', verbose: '详细级别', reasoning: '推理级别', tokens: 'Token 用量',
        delete: '删除', noSessions: '暂无会话', noMatchingSessions: '暂无匹配会话',
        totalSessions: '共 {{count}} 个会话', totalWithAll: '共 {{count}} 个会话 (总计 {{total}})',
        refresh: '刷新', sessionLabel: '会话标签', noChange: '不修改',
        editSession: '编辑会话', deleteSession: '删除会话', irreversible: '此操作不可撤销',
        edit: '编辑', save: '保存', cancel: '取消', confirmDelete: '确认删除',
      },
      chat: { title: 'AI 对话', newChat: '新建对话', sendMessage: '发送消息', all: '全部', noConversations: '暂无对话', startNew: '开始新对话', aiReplyPending: 'AI 回复功能接入中' },
      skillsPage: {
        title: '技能管理', search: '搜索技能...', all: '全部', bundled: '内置', external: '扩展',
        refresh: '刷新', noMatchingSkills: '暂无匹配技能', unavailable: '不可用',
        externalSkills: '扩展技能', bundledSkills: '内置技能',
        missingDeps: '缺失依赖', requirements: '需求', installOptions: '安装选项',
        installing: '安装中...', install: '安装', source: '来源', builtIn: '内置',
        path: '路径', skillKey: 'Skill Key',
      },
      agents: {
        title: 'Agent 管理', overview: '概览', files: '文件', tools: '工具', skills: '技能', channels: '频道', cron: '定时任务', sessionsTab: '会话',
        noAgents: '暂无 Agent', notConnected: '未连接 Gateway', refresh: '刷新', default: '默认',
        newAgent: '新建 Agent', sessions: '会话', selectAgent: '选择一个 Agent 查看详情',
        deleteAgent: '删除 Agent', deleteAgentDesc: '此操作将同时删除关联文件，不可撤销。',
        // Create Agent Dialog
        createAgentTitle: '新建 Agent', name: '名称', namePlaceholder: '例：助手', workspacePath: 'Workspace 路径',
        workspacePathPlaceholder: '例：/path/to/workspace', emojiOptional: 'Emoji（可选）', emojiPlaceholder: '例：🤖',
        // Overview Panel
        basicInfo: '基本信息', heartbeatConfig: '心跳配置', status: '状态', enabled: '已启用', disabled: '已关闭',
        interval: '间隔', target: '目标', model: '模型', sessionInfo: '会话信息', path: '路径',
        // Skills Panel
        skillCount: '技能 ({{count}})', searchSkills: '搜索技能...', install: '安装', installNewSkill: '安装新技能',
        skillName: '技能名称', installId: 'Install ID', noMatchingSkills: '无匹配技能', unavailable: '不可用',
        missing: '缺少', builtIn: '内置', extension: '扩展', enable: '启用', disable: '禁用',
        skillNamePlaceholder: '例：web-search', installIdPlaceholder: '例：npm:@anthropic/skill-web-search',
        heartbeatLabel: '心跳', loadConfigHint: '以调整工具 profile。',
        // Channels Panel
        channelStatus: '频道状态 ({{count}})', noChannelData: '暂无频道数据', connected: '已连接', notLinked: '未关联',
        notConfigured: '未配置', linked: '已关联',
        // Cron Panel
        agentCron: 'Agent 定时任务 ({{count}})', allCron: '全部定时任务 ({{count}})', noCronJobs: '暂无关联定时任务', runNow: '立即执行',
        lastRun: '上次', nextRun: '下次', every: '每 {{sec}}s', scheduledAt: '定时 {{at}}',
        // Files Panel
        workspaceFiles: '工作区文件 ({{count}})', noFiles: '无文件', save: '保存', edit: '编辑',
        markdownContent: 'Markdown 内容...', fileReadError: '(无法读取文件)', selectFileToView: '选择一个文件查看内容',
        // Tools Panel
        toolPermissions: '工具权限', toolPermissionsDesc: 'Profile + 单工具覆盖配置。', enabledCount: '{{count}}/{{total}} 已启用',
        enableAll: '全部启用', disableAll: '全部禁用', reloadConfig: '重载配置', saving: '保存中...', saveConfig: '保存',
        loadGatewayConfig: '加载 Gateway 配置', agentAllowlistHint: '该 Agent 使用了显式 allowlist，工具覆盖在 Config 标签中管理。',
        globalAllowHint: '全局 tools.allow 已设置。Agent 覆盖无法启用被全局屏蔽的工具。',
        preset: '预设', source: '来源', unsaved: '未保存', quickPreset: '快速预设', inheritGlobal: '继承全局',
        agentOverride: 'Agent 覆盖', globalDefault: '全局默认', systemDefault: '系统默认',
        // Sessions Panel
        agentSessions: 'Agent 会话 ({{count}})', allSessions: '全部会话 ({{count}})', noSessions: '暂无会话',
      },
      connect: { title: '连接 OpenClaw Gateway', gatewayUrl: 'Gateway 地址', token: 'Token', connectionFailed: '连接失败' },
      projects: {
        title: '项目', newProject: '新建项目', allProjects: '所有项目', noProjects: '暂无项目',
        noProjectsHint: '创建项目来组织任务和文档',
        projectName: '项目名称', projectNamePlaceholder: '项目名称...',
        projectDesc: '项目描述', projectDescPlaceholder: '项目描述（可选）...',
        noDesc: '暂无描述', tasks: '任务', docs: '文档', completed: '完成', synced: '同步',
        localProjects: '本地', syncedProjects: '同步',
        deleteProject: '删除项目', deleteProjectHint: '关联任务和文档不会被删除',
        // Patrol
        aiPatrol: 'AI 自动巡检', aiPatrolling: 'AI 巡检中', aiPatrolPaused: 'AI 巡检已暂停',
        enableAiPatrol: '开启 AI 自动巡检', enableAiPatrolHint: 'AI 将定期巡检项目任务并推进执行',
        patrolInterval: '巡检频率', patrolAgent: '执行 Agent', defaultAgent: '默认 Agent',
        startPatrol: '开启巡检', deletePatrol: '删除巡检任务', nextRun: '下次',
      },
      deliveries: {
        title: '文档交付中心', all: '全部', pending: '待审核', approved: '已通过', rejected: '已退回',
        revisionNeeded: '需修改', unknown: '未知', noDeliveries: '暂无交付记录', noDeliveriesHint: 'AI 完成任务后推送的文档会显示在这里',
        pendingReview: '{{count}} 条待审核', allDeliveries: '全部交付',
        needModifyReturn: '需修改/退回', externalDoc: '外部文档', localDoc: '本地文档',
        platform: { tencentDoc: '腾讯文档', feishu: '飞书文档', notion: 'Notion', local: '本地文档', external: '外部文档' },
        reviewDoc: '审核文档', docTitle: '文档标题', linkedDoc: '关联文档', externalLink: '外部链接',
        reviewComment: '审核意见（可选）', reviewCommentPlaceholder: '输入审核意见...',
        needModify: '需要修改', return: '退回', pass: '通过', reviewer: '审核人', unknownAi: '未知 AI',
        openDoc: '打开文档', synced: '同步',
        uncategorized: '未分类', deliveryCount: '条交付', linkedTask: '关联任务', linkedProject: '关联项目',
        assignee: '交付者', reReview: '重新审核', reviewResult: '审核结果', submitReview: '提交审核',
      },
      common: { create: '创建', cancel: '取消', save: '保存', delete: '删除', edit: '编辑', editMode: '编辑模式', confirm: '确认', back: '返回', close: '关闭', search: '搜索', noData: '暂无数据', loading: '加载中...', all: '全部', success: '成功' },
      errors: {
        notFound: '资源不存在',
        invalidInput: '输入无效',
        unauthorized: '未授权',
        forbidden: '访问被拒绝',
        internalError: '服务器内部错误',
        taskNotFound: '任务不存在',
        memberNotFound: '成员不存在',
        projectNotFound: '项目不存在',
        documentNotFound: '文档不存在',
        deliveryNotFound: '交付记录不存在',
        milestoneNotFound: '里程碑不存在',
        titleRequired: '标题不能为空',
        memberIdRequired: '成员ID不能为空',
        platformRequired: '平台不能为空',
        invalidStatus: '状态值无效',
        invalidPriority: '优先级值无效',
        invalidPlatform: '平台值无效',
        createFailed: '创建失败',
        updateFailed: '更新失败',
        deleteFailed: '删除失败',
        fetchFailed: '获取数据失败',
        localDocRequiresDocId: '本地文档交付需要关联文档ID',
        externalDocRequiresUrl: '外部文档交付需要提供URL',
        workspaceNotFound: '工作区不存在',
        workspacePathNotExist: '工作区路径不存在',
        syncFailed: '同步失败',
      },
      errorBoundary: { networkError: '网络连接异常', pageError: '页面出现错误', networkHint: '请检查网络连接后重试', pageHint: '抱歉，页面遇到了一些问题。请尝试刷新或返回首页。', details: '错误详情', retry: '重试', goHome: '返回首页' },
      dashboard: {
        title: '工作台',
        connected: '已连接', refresh: '刷新', disconnectBtn: '断开',
        address: '地址', tokenOptional: 'Token（可选）', authToken: '认证 Token',
        connecting: '连接中...', connectBtn: '连接',
        status: '状态', uptime: '运行时间', tickInterval: 'Tick Interval', channelRefresh: '频道刷新',
        onlineInstances: '在线设备/实例', activeSessions: '活跃会话',
        authMode: '认证模式', heartbeatInterval: '心跳间隔',
        channelStatus: '频道状态', configuredLinked: '已连接', configuredNotLinked: '未关联', notConfigured: '未配置',
        agentStatus: 'Agent 状态', defaultLabel: '默认',
        sessions: '会话', heartbeat: '心跳', off: '关闭',
        quickAccess: '快速入口',
        aiMemberStatus: 'AI 成员状态', working: '工作中', idle: '空闲',
        currentTask: '当前任务',
        projectOverview: '项目概览', completed: '完成',
        justNow: '刚刚',
        secondsAgo: '{{count}}s 前', minutesAgo: '{{count}}m 前', hoursAgo: '{{count}}h 前', daysAgo: '{{count}}d 前',
        secondsLater: '{{count}}s 后', minutesLater: '{{count}}m 后', hoursLater: '{{count}}h 后',
        enabled: '启用', disabled: '禁用',
        tasks: '{{count}} 个任务', nextRun: '下次: {{time}}', enabledOfTotal: '{{enabled}}/{{total}} 启用',
      },
      openclaw: {
        title: 'OpenClaw Workspace', desc: '同步本地 Markdown 文件到 CoMind',
        backToSettings: '返回设置', refresh: '刷新', add: '添加',
        noWorkspace: '暂无 Workspace', noWorkspaceHint: '添加一个本地目录，开始同步 Markdown 文件',
        createFirst: '创建第一个 Workspace',
        // Workspace Card
        sync: '同步', watch: '监听', lastSync: '上次同步', error: '错误',
        scan: '扫描', default: '默认',
        // Workspace Form
        createWorkspace: '创建 Workspace', editWorkspace: '编辑 Workspace',
        nameLabel: '名称', namePlaceholder: '我的 Workspace', nameRequired: '名称不能为空',
        pathLabel: '路径', pathPlaceholder: '~/.openclaw/workspace', pathRequired: '路径不能为空',
        pathHint: 'Markdown 文件所在的目录绝对路径',
        enableSync: '启用同步', enableWatch: '实时监听',
        setDefault: '设为默认', syncInterval: '自动同步间隔（分钟）',
        syncIntervalHint: '定时执行全量同步的间隔，与实时监听同时生效。',
        syncIntervalRange: '1-1440 分钟，默认 30',
        excludePatterns: '排除规则（每行一个）',
        excludePlaceholder: 'node_modules/**\n.git/**\ntemp/**',
        cancel: '取消', save: '保存', create: '创建',
        // Status
        statusIdle: '空闲', statusSyncing: '同步中', statusError: '错误',
        // Binding
        notBound: '未绑定 AI 成员，编辑表单中绑定后可启用心跳任务。',
        bindMember: '绑定 AI 成员', noneSelected: '无（未绑定）',
      },
      wiki: {
        title: '文档', search: '搜索文档...', newDoc: '新建文档', noDocs: '暂无文档',
        type: '类型', source: '来源', local: '本地', external: '外部', openclaw: '同步', titleLabel: '标题',
        // Document types
        report: '报告', note: '笔记', decision: '决策', scheduledTask: '定时任务', taskList: '任务列表', other: '其他', all: '全部', guide: '指南', reference: '参考文档',
        // Meta
        clickToLinkProject: '点击关联项目', linkedProjects: '关联项目', notLinked: '未关联任何项目',
        primaryProject: '主', unknownProject: '未知',
        // Knowledge graph
        relations: '关联关系', projectCount: '项目', memberCount: '人员', refs: '引用', backrefs: '反向引用',
        noMembers: '无（用 @成员名 提及）', noRefs: '无（用 [[标题]] 引用）',
        // Create dialog
        createDocTitle: '新建文档', docTitle: '标题', docTitlePlaceholder: '文档标题...',
        docType: '文档类型', willAutoFill: '将自动填充「{{type}}」模板',
        linkProjects: '关联项目（可多选）', noProjects: '暂无项目',
        // Delete dialog
        confirmDelete: '确认删除', deleteWarning: '删除后不可恢复',
        // Editor
        selectToEdit: '选择一个文档开始编辑', startWriting: '开始编写文档...',
        openExternal: '打开',
        // Share link
        share: '分享', shareLink: '分享链接', copyLink: '复制链接', linkCopied: '链接已复制！', copyFailed: '复制失败',
        // OpenClaw edit
        conflictError: '文件已被其他程序修改，请刷新后重试',
        chatWithAI: '与 AI 讨论',
        // 渲染模板
        renderTemplate: '模板', changeTemplate: '更换模板', noTemplate: '无模板', removeTemplate: '移除模板',
      },
      milestones: {
        title: '里程碑', milestone: '里程碑', noMilestones: '暂无里程碑',
        noMilestonesHint: '创建里程碑来划分项目阶段',
        createMilestone: '新建里程碑', editMilestone: '编辑里程碑', deleteMilestone: '删除里程碑',
        milestoneName: '里程碑名称', milestoneNamePlaceholder: '里程碑名称...',
        milestoneDesc: '描述', milestoneDescPlaceholder: '里程碑描述（可选）...',
        dueDate: '截止日期', sortOrder: '排序', status: '状态',
        open: '未开始', inProgress: '进行中', completed: '已完成', cancelled: '已取消',
        deleteConfirm: '确定要删除这个里程碑吗？关联任务将解除绑定。',
        unassigned: '未分配里程碑', milestoneCount: '个里程碑',
        completedCount: '{{completed}}/{{total}} 已完成',
      },
      sop: {
        title: 'SOP 模板', subtitle: '工作流模板',
        newTemplate: '新建模板', search: '搜索模板...',
        all: '全部', content: '内容制作', analysis: '数据分析', research: '调研',
        development: '开发', operations: '运营', media: '多媒体', custom: '自定义',
        // 状态
        status: '状态', draft: '草稿', active: '已启用', archived: '已归档',
        // 模板卡片
        stages: '阶段', noTemplates: '暂无 SOP 模板',
        noTemplatesHint: '创建模板来标准化 AI 工作流程',
        builtin: '内置', global: '全局',
        // 详情
        templateName: '模板名称', templateNamePlaceholder: '模板名称...',
        description: '描述', descriptionPlaceholder: '描述模板用途...',
        category: '分类', selectCategory: '选择分类',
        icon: '图标', iconPlaceholder: '例：clipboard-list',
        // 阶段
        stagesTitle: '阶段配置', addStage: '添加阶段', noStages: '尚未定义阶段',
        stageLabel: '阶段名称', stageLabelPlaceholder: '例：数据收集',
        stageDesc: '阶段描述', stageDescPlaceholder: '描述这个阶段做什么...',
        stageType: '阶段类型',
        stageTypeInput: '等待输入', stageTypeAiAuto: 'AI 自动', stageTypeAiConfirm: 'AI + 确认',
        stageTypeManual: '人工操作', stageTypeRender: '可视化编辑', stageTypeExport: '导出', stageTypeReview: '审核',
        promptTemplate: 'Prompt 模板', promptTemplatePlaceholder: '该阶段的 AI 执行指令...',
        outputType: '产出类型', outputLabel: '产出标签',
        // AI 配置
        aiConfig: 'AI 配置', requiredTools: '必需工具',
        systemPrompt: 'System Prompt', systemPromptPlaceholder: '全局 AI 指令...',
        // 质量
        qualityChecklist: '质量检查项', addCheckItem: '添加检查项',
        // 操作
        createTemplate: '创建模板', editTemplate: '编辑模板',
        deleteTemplate: '删除模板', deleteConfirm: '确定要删除这个模板吗？',
        cannotDelete: '无法删除：模板正被任务使用',
        save: '保存', cancel: '取消',
        // 关联
        linkedProject: '关联项目', noProject: '全局（所有项目可用）',
        tasksUsing: '{{count}} 个任务使用',
        // 拖拽
        dragToReorder: '拖拽排序',
        // 进度展示 (B4)
        progress: 'SOP 进度', currentStage: '当前阶段',
        stageProgress: '{{current}}/{{total}} {{label}}',
        stagePending: '待开始', stageActive: '进行中',
        stageWaitingInput: '等待输入', stageWaitingConfirm: '等待确认',
        stageCompleted: '已完成', stageSkipped: '已跳过', stageFailed: '失败',
        noSopBound: '未绑定 SOP 模板',
        // 确认操作 (B5)
        confirmStage: '确认', rejectStage: '驳回', skipStage: '跳过',
        advanceStage: '推进', confirmAdvance: '确认并推进到下一阶段？',
        confirmReject: '驳回并回退？', stageOutput: '阶段产出',
        // 知识库 (D1-D3)
        knowledgeConfig: '知识库', selectKnowledgeDoc: '选择知识库文档',
        noKnowledgeDoc: '未配置知识库',
        knowledgeLayers: '知识层级', layerL1: 'L1 核心规则',
        layerL2: 'L2 详细标准', layerL3: 'L3 案例库',
        layerL4: 'L4 经验记录', layerL5: 'L5 维护日志',
        knowledgeHint: 'SOP 执行时根据阶段层级配置自动加载知识库',
        // 导入/导出 (D5)
        importTemplate: '导入模板', exportTemplate: '导出模板',
        importSuccess: '模板已导入（草稿状态），请确认后激活',
        importError: '导入失败：格式无效',
        exportSuccess: '模板已导出',
        // Input 阶段
        submitInput: '提交', inputRequired: '必填',
        // 调试
        debugTitle: 'SOP 调试', debugTaskId: '任务 ID', debugTemplate: '模板',
        debugCurrentStage: '当前阶段', debugStageHistory: '阶段历史',
        debugSopInputs: 'SOP 输入', debugNoSopTasks: '暂无 SOP 任务',
        debugRefresh: '刷新', debugStageOutput: '产出',
        // 渲染模板 Tab
        renderTemplatesTab: '渲染模板',
      },
      renderTemplate: {
        title: '渲染模板', subtitle: '可视化模板',
        report: '报告', card: '卡片', poster: '海报', presentation: '演示', custom: '自定义',
        noTemplates: '暂无渲染模板', noTemplatesHint: '创建模板用于文档可视化',
        slots: '个槽位',
        previewTab: '预览', codeTab: '代码', slotsTab: '槽位',
        aiCreate: 'AI 创建', aiCreateHint: '描述你想要的模板，AI 将为你创建',
        aiCreatePlaceholder: '描述你需要的可视化模板，例如：一个蓝色渐变科技风格的数据面板卡片，包含 3 个指标区域 + 摘要区...',
        aiCreateSending: '正在发送给 AI...',
        aiCreateSent: '请求已发送，AI 正在制作中',
      },
      studio: {
        preview: '预览', edit: '编辑', visualEdit: '可视化编辑', fitToWindow: '适应窗口', noContent: '暂无内容可预览',
        selectElement: '在预览中点击元素以编辑属性',
        fontSize: '字号', fontWeight: '字重', textColor: '文字颜色',
        backgroundColor: '背景色', textAlign: '对齐方式',
        letterSpacing: '字间距', lineHeight: '行高',
        imageUrl: '图片地址', replace: '替换', currentContent: '当前内容',
        properties: '属性',
        export: '导出', exportFormat: '格式', exportScale: '倍率',
        exportResolution: '分辨率', exportWidth: '宽度 (px)',
        exportNow: '立即导出',
        exportCleaningHtml: '正在清理 HTML...', exportPreparingFrame: '正在准备导出...',
        exportWaitingResources: '正在等待资源加载...', exportGeneratingImage: '正在生成图片...',
        exportFailed: '导出失败，请重试',
        visualMode: '可视化', renderTemplate: '渲染模板',
        noTemplate: '无模板', templateHint: '选择渲染模板以进行可视化编辑',
        openInStudio: '在 Studio 中编辑', renderStageHint: '该渲染阶段需要可视化编辑',
        templatePreview: '模板预览', templateWithExample: '模板将自动填充示例内容',
        templateVisual: '模板可视化', templateVisualShort: '可视化',
        htmlView: '模板可视化', mdView: 'MD 预览', propertyPanel: '属性面板',
      },
      sopEditor: {
        mdEditMode: 'Markdown 编辑', formEditMode: '表单编辑',
        importSkill: '导入 Skill', importSkillHint: '导入已有的 Skill YAML+Markdown 文件作为 SOP 模板',
        importSkillPlaceholder: '在此粘贴 Skill Markdown 内容（支持 --- frontmatter --- 语法）...',
        parseSkill: '解析并导入', parseSuccess: 'Skill 解析成功',
        parseError: '解析失败：无效的 Skill 格式',
        mdPlaceholder: '# 模板名称\n\n输入 SOP 模板的 Markdown 内容...\n\n## 阶段 1：数据收集\n- type: ai_auto\n- prompt: ...\n\n## 阶段 2：分析\n- type: ai_with_confirm',
      },
    },
  },
};

const getBrowserLanguage = (): string => {
  if (typeof window !== 'undefined') {
    const lang = navigator.language || (navigator as unknown as Record<string, string>).userLanguage;
    if (lang?.startsWith('zh')) return 'zh';
  }
  return 'en';
};

const getSavedLanguage = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('comind-language') || getBrowserLanguage();
  }
  return 'en';
};

// 仅客户端初始化
export const initI18n = () => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: getSavedLanguage(),
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
  }
  return i18n;
};

export const changeLanguage = (lng: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('comind-language', lng);
    i18n.changeLanguage(lng);
  }
};

export default i18n;
