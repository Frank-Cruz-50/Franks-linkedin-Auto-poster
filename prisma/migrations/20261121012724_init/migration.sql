-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "mix" JSONB
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT 'headline',
    "topic" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "stats" JSONB,
    "why" TEXT NOT NULL DEFAULT '',
    "extra" TEXT,
    "trendScore" INTEGER,
    "trendWhy" TEXT,
    "trendSource" TEXT,
    "trendCheckedAt" TEXT,
    "photos" JSONB
);

-- CreateTable
CREATE TABLE "Trend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkedAt" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'news',
    "topics" JSONB,
    "formats" JSONB
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT,
    "articleTitle" TEXT NOT NULL DEFAULT '',
    "articleUrl" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "angle" JSONB,
    "versions" JSONB,
    "photo" TEXT,
    "carousel" JSONB,
    "long" JSONB,
    "finalText" TEXT,
    "chosenVersion" TEXT,
    "chosenHook" INTEGER,
    "suggestedAtPick" TEXT,
    "pickedAt" TEXT,
    "scheduledFor" TEXT,
    "typefullyId" TEXT,
    "photoPick" JSONB,
    "photoAttached" BOOLEAN,
    "impressions" INTEGER,
    "followersGained" INTEGER,
    "autopilot" BOOLEAN NOT NULL DEFAULT false,
    "draftId" TEXT
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "learn" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'banked',
    "version" TEXT,
    "hook" INTEGER,
    "articleId" TEXT,
    "articleTitle" TEXT NOT NULL DEFAULT '',
    "articleUrl" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL DEFAULT '',
    "suggestedAtPick" TEXT,
    "postId" TEXT,
    "typefullyId" TEXT,
    "scheduledFor" TEXT,
    "photo" JSONB,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "voice" TEXT NOT NULL DEFAULT '',
    "structure" TEXT NOT NULL DEFAULT '',
    "guardrails" TEXT NOT NULL DEFAULT '',
    "hooks" TEXT NOT NULL DEFAULT '',
    "loves" TEXT NOT NULL DEFAULT '',
    "banned" TEXT NOT NULL DEFAULT '',
    "research" TEXT NOT NULL DEFAULT '',
    "updatedAt" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "autoResearch" BOOLEAN NOT NULL DEFAULT true,
    "autopilot" BOOLEAN NOT NULL DEFAULT false,
    "ready85" BOOLEAN NOT NULL DEFAULT false,
    "ready85At" TEXT,
    "followers" INTEGER,
    "followersAt" TEXT,
    "searchRequestedAt" TEXT,
    "searchHandledAt" TEXT,
    "searchExclude" JSONB
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "provider" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "progress" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "limitResetsAt" TEXT,
    "turns" INTEGER,
    "durationMs" INTEGER,
    "resultRef" TEXT,
    "startedAt" TEXT NOT NULL,
    "finishedAt" TEXT
);

-- CreateIndex
CREATE INDEX "Article_batchId_idx" ON "Article"("batchId");

-- CreateIndex
CREATE INDEX "JobRun_kind_startedAt_idx" ON "JobRun"("kind", "startedAt");
