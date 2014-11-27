CREATE TABLE IF NOT EXISTS `users` (
  `id` mediumint(8) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(45) COLLATE utf8_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `key_ct` char(128) COLLATE utf8_unicode_ci NOT NULL,
  `key_iv` char(64) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `key` char(16) COLLATE utf8_unicode_ci NOT NULL,
  `value` char(32) COLLATE utf8_unicode_ci NOT NULL,
  `uid` mediumint(8) unsigned NOT NULL,
  `ajax_token` char(16) COLLATE utf8_unicode_ci NOT NULL,
  `key_ct` varchar(128) COLLATE utf8_unicode_ci NOT NULL,
  `key_iv` char(64) COLLATE utf8_unicode_ci NOT NULL,
  `time` int(11) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `uid` (`uid`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`uid`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `metafiles` (
  `id` char(36) COLLATE utf8_unicode_ci NOT NULL,
  `iv` char(64) COLLATE utf8_unicode_ci NOT NULL,
  `ct` mediumtext COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `vaults` (
  `id` char(36) COLLATE utf8_unicode_ci NOT NULL,
  `owner` mediumint(8) unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `credentials` char(36) COLLATE utf8_unicode_ci NOT NULL,
  `fs_root` char(36) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `owner` (`owner`),
  KEY `credentials` (`credentials`),
  KEY `fs_root` (`fs_root`),
  KEY `idWithOwner` (`id`,`owner`),
  CONSTRAINT `vaults_ibfk_1` FOREIGN KEY (`owner`) REFERENCES `users` (`id`),
  CONSTRAINT `vaults_ibfk_3` FOREIGN KEY (`credentials`) REFERENCES `metafiles` (`id`),
  CONSTRAINT `vaults_ibfk_4` FOREIGN KEY (`fs_root`) REFERENCES `metafiles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
