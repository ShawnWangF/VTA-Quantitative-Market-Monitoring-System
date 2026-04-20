CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`signalId` int,
	`market` enum('US','HK') NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`signalType` enum('突破啟動','回踩續強','盤口失衡','冲高衰竭') NOT NULL,
	`level` enum('INFO','WARNING','CRITICAL') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`notifyTriggered` int NOT NULL DEFAULT 0,
	`createdAtMs` bigint NOT NULL,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviewReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reviewDate` varchar(32) NOT NULL,
	`hitRate` double NOT NULL,
	`falsePositiveAnalysis` text NOT NULL,
	`bestSignal` text NOT NULL,
	`worstSignal` text NOT NULL,
	`meta` json NOT NULL,
	CONSTRAINT `reviewReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`market` enum('US','HK') NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`volumeRatio` double NOT NULL,
	`turnover` double NOT NULL,
	`premarketChangePct` double NOT NULL,
	`rankScore` double NOT NULL,
	`notes` text NOT NULL,
	`scanDate` varchar(32) NOT NULL,
	CONSTRAINT `scanResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`market` enum('US','HK') NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`signalType` enum('突破啟動','回踩續強','盤口失衡','冲高衰竭') NOT NULL,
	`score` double NOT NULL,
	`triggerReason` text NOT NULL,
	`riskTags` json NOT NULL,
	`direction` enum('做多','做空','观察') NOT NULL,
	`entryRange` varchar(128) NOT NULL,
	`stopLoss` varchar(128) NOT NULL,
	`rationale` text NOT NULL,
	`llmInterpretation` longtext,
	`createdAtMs` bigint NOT NULL,
	CONSTRAINT `signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `systemSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`scanThresholds` json NOT NULL,
	`signalSensitivity` enum('保守','标准','激进') NOT NULL DEFAULT '标准',
	`alertLevelPreference` enum('INFO','WARNING','CRITICAL') NOT NULL DEFAULT 'WARNING',
	`watchlistLimit` int NOT NULL DEFAULT 30,
	`highScoreNotifyThreshold` double NOT NULL DEFAULT 85,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `systemSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `watchlistItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`market` enum('US','HK') NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`priority` int NOT NULL DEFAULT 3,
	`lastPrice` double NOT NULL DEFAULT 0,
	`changePct` double NOT NULL DEFAULT 0,
	`volume` bigint NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlistItems_id` PRIMARY KEY(`id`)
);
