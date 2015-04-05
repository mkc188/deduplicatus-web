--
-- Database: `deduplicatus`
--

-- --------------------------------------------------------

--
-- Table structure for table `metafile_locks`
--

CREATE TABLE IF NOT EXISTS `metafile_locks` (
  `lockid` char(36) COLLATE utf8_unicode_ci NOT NULL,
  `userid` char(36) COLLATE utf8_unicode_ci NOT NULL,
  `start_time` int(10) unsigned NOT NULL,
  `end_time` int(10) unsigned NOT NULL,
  `ip_address` int(10) unsigned NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `metafile_versions`
--

CREATE TABLE IF NOT EXISTS `metafile_versions` (
  `versionid` char(36) COLLATE utf8_unicode_ci NOT NULL,
  `userid` char(36) COLLATE utf8_unicode_ci NOT NULL,
  `time` int(10) unsigned NOT NULL,
  `completed` tinyint(1) unsigned NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE IF NOT EXISTS `users` (
  `userid` char(36) COLLATE utf8_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `password` char(45) COLLATE utf8_unicode_ci NOT NULL,
  `salt` char(45) COLLATE utf8_unicode_ci NOT NULL,
  `meta_lock` char(36) COLLATE utf8_unicode_ci DEFAULT NULL,
  `meta_secret` char(36) COLLATE utf8_unicode_ci NOT NULL,
  `meta_version` char(36) COLLATE utf8_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `metafile_locks`
--
ALTER TABLE `metafile_locks`
  ADD PRIMARY KEY (`lockid`), ADD KEY `userid` (`userid`);

--
-- Indexes for table `metafile_versions`
--
ALTER TABLE `metafile_versions`
  ADD PRIMARY KEY (`versionid`), ADD KEY `userid` (`userid`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`userid`), ADD UNIQUE KEY `email` (`email`), ADD KEY `meta_lock` (`meta_lock`), ADD KEY `meta_version` (`meta_version`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `metafile_locks`
--
ALTER TABLE `metafile_locks`
ADD CONSTRAINT `metafile_locks_ibfk_1` FOREIGN KEY (`userid`) REFERENCES `users` (`userid`);
