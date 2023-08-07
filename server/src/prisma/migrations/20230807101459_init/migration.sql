-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "firstPlayerId" TEXT NOT NULL,
    "secondPlayerId" TEXT NOT NULL,
    "winnerId" TEXT,
    "isEnded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Game_winnerId_idx" ON "Game"("winnerId");

-- CreateIndex
CREATE INDEX "Game_firstPlayerId_idx" ON "Game"("firstPlayerId");

-- CreateIndex
CREATE INDEX "Game_secondPlayerId_idx" ON "Game"("secondPlayerId");
