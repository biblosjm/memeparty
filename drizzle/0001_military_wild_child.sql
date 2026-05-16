CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`playerId` int NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emojiReactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`playerId` int NOT NULL,
	`emoji` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emojiReactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gameQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameMode` enum('meme_title','internet_culture','friend_predict') NOT NULL,
	`content` text NOT NULL,
	`options` json,
	`correctAnswer` text,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gameQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gameResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` int NOT NULL,
	`playerId` int NOT NULL,
	`content` text NOT NULL,
	`voteCount` int NOT NULL DEFAULT 0,
	`isCorrect` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gameResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gameRounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`roundNumber` int NOT NULL,
	`status` enum('waiting','playing','voting','ended') NOT NULL DEFAULT 'waiting',
	`gameMode` enum('meme_title','internet_culture','friend_predict') NOT NULL,
	`questionId` int,
	`imageUrl` text,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gameRounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`nickname` varchar(64) NOT NULL,
	`role` enum('player','spectator') NOT NULL DEFAULT 'player',
	`score` int NOT NULL DEFAULT 0,
	`level` int NOT NULL DEFAULT 1,
	`exp` int NOT NULL DEFAULT 0,
	`winStreak` int NOT NULL DEFAULT 0,
	`isMvp` boolean NOT NULL DEFAULT false,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`leftAt` timestamp,
	CONSTRAINT `players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomCode` varchar(8) NOT NULL,
	`status` enum('waiting','playing','ended') NOT NULL DEFAULT 'waiting',
	`gameMode` enum('meme_title','internet_culture','friend_predict') NOT NULL,
	`maxPlayers` int NOT NULL DEFAULT 8,
	`currentRound` int NOT NULL DEFAULT 0,
	`totalRounds` int NOT NULL DEFAULT 3,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rooms_roomCode_unique` UNIQUE(`roomCode`)
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` int NOT NULL,
	`voterId` int NOT NULL,
	`responseId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `votes_id` PRIMARY KEY(`id`)
);
