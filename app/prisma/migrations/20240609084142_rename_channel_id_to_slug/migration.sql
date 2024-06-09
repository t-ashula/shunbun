/*
  Warnings:

  - You are about to drop the column `channel_id` on the `channels` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `channels` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `channels` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `channels_channel_id_key` ON `channels`;

-- AlterTable
ALTER TABLE `channels` RENAME COLUMN `channel_id` TO `slug` ;

-- CreateIndex
CREATE UNIQUE INDEX `channels_slug_key` ON `channels`(`slug`);
