-- CreateTable
CREATE TABLE `channels` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `channel_id` VARCHAR(26) NOT NULL,
    `name` VARCHAR(500) NOT NULL DEFAULT '',
    `crawl_url` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `channels_channel_id_key`(`channel_id`),
    PRIMARY KEY (`id`)
);
