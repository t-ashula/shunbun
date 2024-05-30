-- CreateTable
CREATE TABLE `channel_statuses` (
    `id` INTEGER NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `description` TEXT NOT NULL,

    UNIQUE INDEX `channel_statuses_name_key`(`name`),
    PRIMARY KEY (`id`)
);
