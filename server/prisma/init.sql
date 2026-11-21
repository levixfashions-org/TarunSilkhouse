-- Tarun Silks — full database structure for MySQL 8 / MariaDB 10.6+
-- Matches prisma/schema.prisma. Import once in Hostinger hPanel → Databases → phpMyAdmin → Import.
-- (Alternative from your own PC: `npx prisma db push` with DATABASE_URL pointing at the Hostinger DB.)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(191) NOT NULL,
  `firebaseUid` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `name` VARCHAR(191) NULL,
  `role` ENUM('CUSTOMER','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_firebaseUid_key`(`firebaseUid`),
  UNIQUE INDEX `User_email_key`(`email`),
  INDEX `User_phone_idx`(`phone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Address` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `line1` VARCHAR(191) NOT NULL,
  `line2` VARCHAR(191) NULL,
  `landmark` VARCHAR(191) NULL,
  `city` VARCHAR(191) NOT NULL,
  `state` VARCHAR(191) NOT NULL,
  `pincode` VARCHAR(6) NOT NULL,
  `lat` DOUBLE NULL,
  `lng` DOUBLE NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Address_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Category` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL DEFAULT 'fabric',
  `image` VARCHAR(191) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `showInNav` BOOLEAN NOT NULL DEFAULT true,
  UNIQUE INDEX `Category_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Product` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `fabric` VARCHAR(191) NOT NULL,
  `weave` VARCHAR(191) NULL,
  `work` VARCHAR(191) NULL,
  `border` VARCHAR(191) NULL,
  `pallu` VARCHAR(191) NULL,
  `origin` VARCHAR(191) NULL,
  `care` TEXT NULL,
  `occasions` JSON NOT NULL,
  `lengthInfo` VARCHAR(191) NOT NULL DEFAULT 'Saree 5.5 m + blouse piece 0.8 m',
  `blouseIncluded` BOOLEAN NOT NULL DEFAULT true,
  `handloomMark` BOOLEAN NOT NULL DEFAULT false,
  `price` INTEGER NOT NULL,
  `mrp` INTEGER NOT NULL,
  `falloPicoPrice` INTEGER NOT NULL DEFAULT 0,
  `stitchingPrice` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `isPinned` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `popularity` INTEGER NOT NULL DEFAULT 0,
  `seoTitle` VARCHAR(191) NULL,
  `seoDescription` VARCHAR(191) NULL,
  `categoryId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Product_slug_key`(`slug`),
  INDEX `Product_categoryId_idx`(`categoryId`),
  INDEX `Product_createdAt_idx`(`createdAt`),
  INDEX `Product_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProductColour` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `colourName` VARCHAR(191) NOT NULL,
  `hex` VARCHAR(7) NOT NULL,
  `family` VARCHAR(191) NULL,
  `stock` INTEGER NOT NULL DEFAULT 0,
  `priceDelta` INTEGER NOT NULL DEFAULT 0,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  INDEX `ProductColour_productId_idx`(`productId`),
  INDEX `ProductColour_family_idx`(`family`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProductImage` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `colourId` VARCHAR(191) NULL,
  `url` VARCHAR(1024) NOT NULL,
  `alt` VARCHAR(191) NULL,
  `tag` ENUM('MODEL','DETAIL','FLATLAY','OTHER') NOT NULL DEFAULT 'OTHER',
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  INDEX `ProductImage_productId_sortOrder_idx`(`productId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Collection` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `handle` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `image` VARCHAR(1024) NULL,
  `accent` VARCHAR(7) NULL,
  `isRuleBased` BOOLEAN NOT NULL DEFAULT false,
  `rules` JSON NULL,
  `showInNav` BOOLEAN NOT NULL DEFAULT true,
  `isEditorial` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `Collection_handle_key`(`handle`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CollectionProduct` (
  `collectionId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`collectionId`, `productId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Cart` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `remindedAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Cart_userId_idx`(`userId`),
  INDEX `Cart_updatedAt_idx`(`updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CartItem` (
  `id` VARCHAR(191) NOT NULL,
  `cartId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `colourId` VARCHAR(191) NOT NULL,
  `qty` INTEGER NOT NULL,
  `options` JSON NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Order` (
  `id` VARCHAR(191) NOT NULL,
  `number` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING_PAYMENT','PLACED','PACKED','SHIPPED','DELIVERED','CANCELLED','RETURNED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  `paymentMethod` ENUM('RAZORPAY','COD') NOT NULL,
  `subtotal` INTEGER NOT NULL,
  `discount` INTEGER NOT NULL DEFAULT 0,
  `shipping` INTEGER NOT NULL DEFAULT 0,
  `codFee` INTEGER NOT NULL DEFAULT 0,
  `giftWrap` INTEGER NOT NULL DEFAULT 0,
  `tax` INTEGER NOT NULL DEFAULT 0,
  `total` INTEGER NOT NULL,
  `couponCode` VARCHAR(191) NULL,
  `giftMessage` TEXT NULL,
  `shipName` VARCHAR(191) NOT NULL,
  `shipLine1` VARCHAR(191) NOT NULL,
  `shipLine2` VARCHAR(191) NULL,
  `shipLandmark` VARCHAR(191) NULL,
  `shipCity` VARCHAR(191) NOT NULL,
  `shipState` VARCHAR(191) NOT NULL,
  `shipPincode` VARCHAR(6) NOT NULL,
  `lat` DOUBLE NULL,
  `lng` DOUBLE NULL,
  `courier` VARCHAR(191) NULL,
  `awb` VARCHAR(191) NULL,
  `trackingUrl` VARCHAR(1024) NULL,
  `notes` TEXT NULL,
  `stockReleased` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Order_number_key`(`number`),
  UNIQUE INDEX `Order_idempotencyKey_key`(`idempotencyKey`),
  INDEX `Order_phone_idx`(`phone`),
  INDEX `Order_createdAt_idx`(`createdAt`),
  INDEX `Order_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OrderItem` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NULL,
  `colourId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `colourName` VARCHAR(191) NOT NULL,
  `image` VARCHAR(1024) NULL,
  `unitPrice` INTEGER NOT NULL,
  `qty` INTEGER NOT NULL,
  `servicesFee` INTEGER NOT NULL DEFAULT 0,
  `options` JSON NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OrderStatusEvent` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING_PAYMENT','PLACED','PACKED','SHIPPED','DELIVERED','CANCELLED','RETURNED') NOT NULL,
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `OrderStatusEvent_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Payment` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `method` ENUM('RAZORPAY','COD') NOT NULL,
  `status` ENUM('CREATED','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED','COD_PENDING','COD_COLLECTED') NOT NULL,
  `amount` INTEGER NOT NULL,
  `razorpayOrderId` VARCHAR(191) NULL,
  `razorpayPaymentId` VARCHAR(191) NULL,
  `refundedAmount` INTEGER NOT NULL DEFAULT 0,
  `raw` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Payment_razorpayOrderId_key`(`razorpayOrderId`),
  UNIQUE INDEX `Payment_razorpayPaymentId_key`(`razorpayPaymentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Coupon` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `type` ENUM('PERCENT','FLAT','FREE_SHIPPING') NOT NULL,
  `value` INTEGER NOT NULL,
  `minCart` INTEGER NOT NULL DEFAULT 0,
  `maxDiscount` INTEGER NULL,
  `usageLimit` INTEGER NULL,
  `usedCount` INTEGER NOT NULL DEFAULT 0,
  `perUser` INTEGER NULL,
  `expiresAt` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Coupon_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Review` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `rating` INTEGER NOT NULL,
  `title` VARCHAR(191) NULL,
  `body` TEXT NOT NULL,
  `photos` JSON NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Review_userId_productId_orderId_key`(`userId`, `productId`, `orderId`),
  INDEX `Review_productId_status_idx`(`productId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WishlistItem` (
  `userId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`, `productId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StockAlert` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `colourId` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `notifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `StockAlert_productId_colourId_idx`(`productId`, `colourId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Page` (
  `id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` LONGTEXT NOT NULL,
  `seoTitle` VARCHAR(191) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Page_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `HomeSection` (
  `id` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NULL,
  `data` JSON NOT NULL,
  `isVisible` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Setting` (
  `key` VARCHAR(191) NOT NULL,
  `value` JSON NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MediaFile` (
  `id` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `original` VARCHAR(1024) NOT NULL,
  `thumb` VARCHAR(1024) NOT NULL,
  `main` VARCHAR(1024) NOT NULL,
  `zoom` VARCHAR(1024) NOT NULL,
  `width` INTEGER NOT NULL,
  `height` INTEGER NOT NULL,
  `bytes` INTEGER NOT NULL,
  `mime` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MediaFile_key_key`(`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Subscriber` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Subscriber_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `Address` ADD CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ProductColour` ADD CONSTRAINT `ProductColour_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_colourId_fkey` FOREIGN KEY (`colourId`) REFERENCES `ProductColour`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CollectionProduct` ADD CONSTRAINT `CollectionProduct_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `Collection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CollectionProduct` ADD CONSTRAINT `CollectionProduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Cart` ADD CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_colourId_fkey` FOREIGN KEY (`colourId`) REFERENCES `ProductColour`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_colourId_fkey` FOREIGN KEY (`colourId`) REFERENCES `ProductColour`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OrderStatusEvent` ADD CONSTRAINT `OrderStatusEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Review` ADD CONSTRAINT `Review_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Review` ADD CONSTRAINT `Review_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `StockAlert` ADD CONSTRAINT `StockAlert_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `StockAlert` ADD CONSTRAINT `StockAlert_colourId_fkey` FOREIGN KEY (`colourId`) REFERENCES `ProductColour`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
