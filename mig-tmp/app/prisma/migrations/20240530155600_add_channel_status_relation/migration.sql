/*
  Warnings:

  - Added the required column `channel_status_id` to the `channels` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `channels` ADD COLUMN `channel_status_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `channels` ADD CONSTRAINT `channels_channel_status_id_fkey` FOREIGN KEY (`channel_status_id`) REFERENCES `channel_statuses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
