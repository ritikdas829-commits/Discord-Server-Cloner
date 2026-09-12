let currentLang = process.env.LANGUAGE?.toLowerCase() === 'en' ? 'en' : 'tr';

export function setLanguage(lang) {
  if (['tr', 'en'].includes(lang.toLowerCase())) {
    currentLang = lang.toLowerCase();
  }
}

export function getLanguage() {
  return currentLang;
}

export const translations = {
  tr: {
    bannerTitle: '⚡ NEXT-GEN DISCORD SERVER CLONER',
    bannerDeveloper: '👑 Geliştirici:',
    bannerEngine: '🛡️  Motor:',
    bannerEngineDesc: 'Adaptive Rate-Limit & ID Perm Mapper',
    bannerModes: '🌐 Modlar:',
    bannerModesDesc: 'Canlı Sunucu Klonlama / JSON Şablon Yedekleme & Kurulum',
    bannerWarning: '⚠️  Dikkat:',
    bannerWarningDesc: 'Hedef sunucuda Yönetici (Administrator) yetkiniz olmalıdır!',

    // Token
    tokenMissingEnv: '.env dosyasında DISCORD_TOKEN bulunamadı.',
    tokenPrompt: 'Lütfen Discord Tokeninizi girin (User Token veya Bot Token):',
    tokenInvalid: 'Geçerli bir token giriniz!',
    connectingDiscord: 'Discord sunucularına bağlanılıyor...',
    loginSuccess: 'Başarıyla giriş yapıldı:',
    totalGuilds: 'Hesabın bulunduğu toplam sunucu sayısı:',
    loginFailed: 'Giriş başarısız! Token geçersiz veya erişim engellendi:',

    // Main Menu
    menuTitle: 'Lütfen gerçekleştirmek istediğiniz işlemi seçin:',
    menuDirectClone: '⚡ Canlı Klonlama (Doğrudan Sunucudan Sunucuya Aktar)',
    menuDirectCloneDesc: 'Kaynak sunucudaki tüm rolleri, kanalları ve emojileri hedef sunucuya aktarır.',
    menuCreateBackup: '💾 Şablon Oluştur (Sunucuyu JSON Dosyasına Yedekle)',
    menuCreateBackupDesc: 'Sunucu yapısını gelecekte kullanmak üzere taşınabilir bir JSON şablonu olarak kaydeder.',
    menuRestoreBackup: '📦 Şablondan Kur (JSON Dosyasını Sunucuya Geri Yükle)',
    menuRestoreBackupDesc: 'Daha önce kaydedilmiş bir JSON şablonunu hedef sunucuya uygular.',
    menuChangeLang: '🌐 Dili Değiştir / Change Language (TR ⇄ EN)',
    menuChangeLangDesc: 'Programın dilini Türkçe veya İngilizce olarak değiştirin.',
    menuExit: '❌ Çıkış',
    menuExitDesc: 'Programı sonlandır.',

    // Guild selection
    selectGuildTitle: 'Sunucu seçin:',
    selectSourceGuild: 'Kaynak Sunucuyu Seçin (Kopyalanacak Sunucu):',
    selectTargetGuild: 'Hedef Sunucuyu Seçin (Klonun Yapılacağı Sunucu):',
    selectBackupSource: 'Şablonu çıkarılacak sunucuyu seçin:',
    selectRestoreTarget: 'Şablonun kurulacağı hedef sunucuyu seçin:',
    searchInstruction: '(Yazarak arayabilirsiniz)',
    sameGuildError: 'Kaynak ve hedef sunucu aynı olamaz!',
    manualInputOption: 'Elle Sunucu ID Gir...',
    manualInputPrompt: 'Sunucu ID giriniz:',
    invalidId: 'Geçerli bir Discord Snowflake ID girin!',
    adminBadge: '👑 [YÖNETİCİ]',
    notAdminBadge: '[Yönetici Değilsiniz]',
    headerAdminGuilds: '─── 👑 YÖNETİCİ OLDUĞUNUZ HEDEF SUNUCULAR ───',
    headerOtherGuilds: '─── ⚠️ DİĞER SUNUCULAR (Yönetici Değilsiniz) ───',
    memberCount: 'Üye',

    // Clone Options
    optClearTarget: 'Hedef sunucudaki mevcut kanallar ve roller temizlensin mi?',
    optCloneEmojis: 'Özel emojiler kopyalansın mı?',
    optCloneMedia: 'Sunucu simgesi (ikonu) ve afişi (banner) kopyalansın mı?',
    optCloneMessages: 'Kanal mesajları Webhook ile kopyalansın mı? (İşlem süresini uzatır)',
    optMaxMessages: 'Kanal başına kopyalanacak mesaj sayısı:',

    // Cloner steps
    stepCleaning: 'Hedef Sunucu Temizliği',
    stepSettings: 'Sunucu Temel Bilgileri & Medya (İkon/Afiş)',
    stepRoles: 'Roller ve İzin Hiyerarşisi',
    stepChannels: 'Kategoriler, Metin ve Ses Kanalları',
    stepEmojis: 'Özel Sunucu Emojileri',
    stepMessages: 'Kanal Mesajları (Webhook)',

    // Actions & Logs
    sourceNotFound: 'Kaynak sunucu bulunamadı! Hesabınızın bu sunucuda olduğundan emin olun.',
    targetNotFound: 'Hedef sunucu bulunamadı! Hesabınızın bu sunucuda olduğundan emin olun.',
    missingAdminWarning: 'Hedef sunucuda Yönetici (Administrator) yetkiniz olmayabilir. Bazı işlemler başarısız olabilir!',
    refreshingData: 'Sunucu verileri Discord API\'den tazeleniyor...',
    cleaningTarget: 'Hedef sunucu taranıyor ve temizleniyor...',
    channelsToDelete: 'Temizlenecek toplam kanal:',
    rolesToDelete: 'Temizlenecek toplam rol:',
    deletedChannel: 'Silindi: [Kanal]',
    deletedRole: 'Silindi: [Rol]',
    cleanCompleted: 'Hedef sunucu temizliği tamamlandı.',
    nameUpdated: 'Sunucu ismi güncellendi:',
    iconUpdated: 'Sunucu simgesi (ikonu) başarıyla aktarıldı.',
    bannerUpdated: 'Sunucu afişi (banner) aktarıldı.',
    splashUpdated: 'Sunucu davet arka planı (splash) aktarıldı.',
    scanningRoles: 'Roller taranıyor ve hiyerarşik olarak oluşturuluyor...',
    everyoneSynced: '@everyone rol izinleri eşitlendi.',
    totalRolesToClone: 'Klonlanacak toplam rol sayısı:',
    createdRole: 'Oluşturuldu: [Rol]',
    roleHierarchySync: 'Rol hiyerarşisi ve sıralaması senkronize ediliyor...',
    roleHierarchyDone: 'Rol hiyerarşisi başarıyla eşitlendi.',
    rolesCompleted: 'Rol klonlama tamamlandı. Toplam:',
    scanningChannels: 'Kategoriler ve kanallar taranıyor...',
    totalCategoriesToClone: 'Klonlanacak kategori sayısı:',
    createdCategory: 'Oluşturuldu: [Kategori]',
    totalChannelsToClone: 'Klonlanacak kanal sayısı:',
    createdChannel: 'Oluşturuldu: [Kanal]',
    channelsCompleted: 'Kanal ve kategori klonlama tamamlandı.',
    scanningEmojis: 'Emojiler taranıyor... Toplam emoji:',
    noEmojisFound: 'Kaynak sunucuda kopyalanacak emoji bulunamadı.',
    noEmojiSlots: 'Hedef sunucuda boş emoji slotu kalmadı. Emoji aktarımı atlanıyor.',
    createdEmoji: 'Oluşturuldu: [Emoji]',
    emojiAlreadyExists: 'Emoji zaten mevcut, atlandı:',
    emojisCompleted: 'Emoji klonlama tamamlandı. Toplam:',
    messagesCloningStart: 'Mesaj kopyalama başlatılıyor...',
    transferringMessages: 'kanalına mesajlar aktarılıyor...',
    messagesCompleted: 'Mesaj aktarımı tamamlandı. Toplam:',

    // Backup & Restore
    backupCreating: 'için JSON şablonu oluşturuluyor...',
    backupIconDownloading: 'Sunucu ikonu indiriliyor...',
    backupBannerDownloading: 'Sunucu afişi indiriliyor...',
    backupSuccess: 'Yedek şablon başarıyla oluşturuldu:',
    noBackupsFound: 'backups/ klasöründe herhangi bir .json şablon dosyası bulunamadı!',
    selectBackupFile: 'Geri yüklenecek şablon dosyasını seçin:',
    readingTemplate: 'Şablon dosyası okunuyor:',
    templateInfo: 'Şablon Bilgisi:',

    // Stats
    statsReportTitle: '       ★ VIQOLE CLONER İSTATİSTİK RAPORU ★',
    statsRoles: '👑 Oluşturulan Roller:',
    statsCategories: '📁 Oluşturulan Kategoriler:',
    statsChannels: '💬 Oluşturulan Kanallar:',
    statsEmojis: '😀 Kopyalanan Emojiler:',
    statsMessages: '📨 Aktarılan Mesajlar:',
    statsFailed: '⚠️  Başarısız İşlemler:',
    statsSuccessRate: '📈 Başarı Oranı:',
    statsElapsedTime: '⏱️  Toplam Geçen Süre:',
    statsFooter: 'Yapan: viqole | Teşekkürler!',

    // Exit
    exitMessage: 'Viqole Cloner kapatılıyor. İyi günler dileriz!'
  },
  en: {
    bannerTitle: '⚡ NEXT-GEN DISCORD SERVER CLONER',
    bannerDeveloper: '👑 Developer:',
    bannerEngine: '🛡️  Engine:',
    bannerEngineDesc: 'Adaptive Rate-Limit & ID Perm Mapper',
    bannerModes: '🌐 Modes:',
    bannerModesDesc: 'Live Server-to-Server / JSON Template Backup & Restore',
    bannerWarning: '⚠️  Caution:',
    bannerWarningDesc: 'You must have Administrator permissions on the target server!',

    // Token
    tokenMissingEnv: 'DISCORD_TOKEN was not found in .env file.',
    tokenPrompt: 'Please enter your Discord Token (User Token or Bot Token):',
    tokenInvalid: 'Please enter a valid token!',
    connectingDiscord: 'Connecting to Discord servers...',
    loginSuccess: 'Successfully logged in as:',
    totalGuilds: 'Total servers on this account:',
    loginFailed: 'Login failed! Token is invalid or access was blocked:',

    // Main Menu
    menuTitle: 'Please select an action to perform:',
    menuDirectClone: '⚡ Direct Clone (Live Server-to-Server)',
    menuDirectCloneDesc: 'Clones all roles, channels, and emojis directly from source to target server.',
    menuCreateBackup: '💾 Create Backup (Save Server as JSON Template)',
    menuCreateBackupDesc: 'Saves the server structure as a portable JSON template for future use.',
    menuRestoreBackup: '📦 Restore Template (Apply JSON Template to Server)',
    menuRestoreBackupDesc: 'Applies a previously saved JSON template to a target server.',
    menuChangeLang: '🌐 Dili Değiştir / Change Language (TR ⇄ EN)',
    menuChangeLangDesc: 'Toggle language between Turkish and English.',
    menuExit: '❌ Exit',
    menuExitDesc: 'Exit the program.',

    // Guild selection
    selectGuildTitle: 'Select a server:',
    selectSourceGuild: 'Select Source Server (Server to copy):',
    selectTargetGuild: 'Select Target Server (Server to clone into):',
    selectBackupSource: 'Select server to export as template:',
    selectRestoreTarget: 'Select target server to restore template into:',
    searchInstruction: '(Type to search)',
    sameGuildError: 'Source and target servers cannot be the same!',
    manualInputOption: 'Enter Server ID Manually...',
    manualInputPrompt: 'Enter Server ID:',
    invalidId: 'Please enter a valid Discord Snowflake ID!',
    adminBadge: '👑 [ADMIN]',
    notAdminBadge: '[No Admin Permissions]',
    headerAdminGuilds: '─── 👑 TARGET SERVERS WHERE YOU HAVE ADMIN ───',
    headerOtherGuilds: '─── ⚠️ OTHER SERVERS (No Admin Permissions) ───',
    memberCount: 'Members',

    // Clone Options
    optClearTarget: 'Delete existing channels and roles in the target server?',
    optCloneEmojis: 'Clone custom emojis?',
    optCloneMedia: 'Clone server icon and banner?',
    optCloneMessages: 'Clone channel messages via Webhook? (Takes longer)',
    optMaxMessages: 'Max messages to copy per channel:',

    // Cloner steps
    stepCleaning: 'Target Server Cleanup',
    stepSettings: 'Server Information & Media (Icon/Banner)',
    stepRoles: 'Roles and Permission Hierarchy',
    stepChannels: 'Categories, Text, and Voice Channels',
    stepEmojis: 'Custom Server Emojis',
    stepMessages: 'Channel Messages (Webhook)',

    // Actions & Logs
    sourceNotFound: 'Source server not found! Ensure your account is a member of this server.',
    targetNotFound: 'Target server not found! Ensure your account is a member of this server.',
    missingAdminWarning: 'You might not have Administrator permissions in the target server. Some actions may fail!',
    refreshingData: 'Fetching fresh server data from Discord API...',
    cleaningTarget: 'Scanning and cleaning target server...',
    channelsToDelete: 'Total channels to clean:',
    rolesToDelete: 'Total roles to clean:',
    deletedChannel: 'Deleted: [Channel]',
    deletedRole: 'Deleted: [Role]',
    cleanCompleted: 'Target server cleanup completed.',
    nameUpdated: 'Server name updated to:',
    iconUpdated: 'Server icon successfully transferred.',
    bannerUpdated: 'Server banner transferred.',
    splashUpdated: 'Server invite splash transferred.',
    scanningRoles: 'Scanning roles and creating hierarchically...',
    everyoneSynced: '@everyone role permissions synchronized.',
    totalRolesToClone: 'Total roles to clone:',
    createdRole: 'Created: [Role]',
    roleHierarchySync: 'Synchronizing role hierarchy and positions...',
    roleHierarchyDone: 'Role hierarchy successfully synchronized.',
    rolesCompleted: 'Role cloning completed. Total:',
    scanningChannels: 'Scanning categories and channels...',
    totalCategoriesToClone: 'Total categories to clone:',
    createdCategory: 'Created: [Category]',
    totalChannelsToClone: 'Total channels to clone:',
    createdChannel: 'Created: [Channel]',
    channelsCompleted: 'Channel and category cloning completed.',
    scanningEmojis: 'Scanning emojis... Total emojis:',
    noEmojisFound: 'No custom emojis found in source server.',
    noEmojiSlots: 'No available emoji slots in target server. Skipping emoji transfer.',
    createdEmoji: 'Created: [Emoji]',
    emojiAlreadyExists: 'Emoji already exists, skipped:',
    emojisCompleted: 'Emoji cloning completed. Total:',
    messagesCloningStart: 'Starting message cloning...',
    transferringMessages: 'transferring messages to channel...',
    messagesCompleted: 'Message cloning completed. Total:',

    // Backup & Restore
    backupCreating: 'Creating JSON template for',
    backupIconDownloading: 'Downloading server icon...',
    backupBannerDownloading: 'Downloading server banner...',
    backupSuccess: 'Backup template successfully created:',
    noBackupsFound: 'No .json template files found in backups/ directory!',
    selectBackupFile: 'Select a template file to restore:',
    readingTemplate: 'Reading template file:',
    templateInfo: 'Template Information:',

    // Stats
    statsReportTitle: '       ★ VIQOLE CLONER STATS REPORT ★',
    statsRoles: '👑 Roles Created:',
    statsCategories: '📁 Categories Created:',
    statsChannels: '💬 Channels Created:',
    statsEmojis: '😀 Emojis Cloned:',
    statsMessages: '📨 Messages Cloned:',
    statsFailed: '⚠️  Failed Operations:',
    statsSuccessRate: '📈 Success Rate:',
    statsElapsedTime: '⏱️  Total Elapsed Time:',
    statsFooter: 'Made by viqole | Thank you!',

    // Exit
    exitMessage: 'Exiting Viqole Cloner. Have a great day!'
  }
};

export function t(key) {
  const dict = translations[currentLang] || translations.tr;
  return dict[key] || translations.tr[key] || key;
}
