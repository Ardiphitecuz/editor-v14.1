export interface Article {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string[];
  source: string;
  image: string;
  readTime: number;
  publishedAt: string;
  hot?: boolean;
}

export const ARTICLES: Article[] = [
  {
    id: "1",
    category: "Hot Topic",
    title: 'Perang Saudara Digital: Fanart "Dandadan" Versi Kulit Hitam Picu Badai Rasial di Twitter',
    summary:
      "Sebuah karya fanart anime Dandadan yang menggambarkan karakter utama dengan kulit hitam memicu perdebatan sengit di platform X, membelah komunitas anime menjadi dua kubu yang saling serang.",
    content: [
      "Komunitas anime kembali diguncang kontroversi besar. Sebuah fanart dari serial anime populer Dandadan yang menggambarkan karakter utamanya, Ken Takakura, sebagai seorang pria berkulit hitam, mendadak menjadi pusat perdebatan panas di platform X (dulu Twitter) selama beberapa hari terakhir.",
      "Gambar tersebut diunggah oleh seorang seniman digital bernama @Lynn6Thorex yang menyebut karyanya sebagai bentuk 'apresiasi inklusif terhadap medium anime'. Dalam hitungan jam, postingan itu meraup lebih dari 200 ribu likes dan 80 ribu repost — angka yang luar biasa untuk sebuah fanart.",
      "Namun di balik angka tersebut, tersimpan komentar-komentar penuh kebencian. Satu kelompok pengguna berargumen bahwa mengubah ras karakter merupakan bentuk 'raceswapping' yang tidak menghormati karya asli mangaka. Kelompok lain dengan keras membela seniman tersebut, menyebut kritik itu sebagai manifestasi rasisme terselubung dalam komunitas otaku.",
      '"Dandadan itu karya Tatsu Yukinobu, seorang seniman Jepang. Karakter-karakternya diciptakan dengan identitas tertentu. Mengubahnya bukan apresiasi, itu distorsi," tulis salah satu pengguna dengan ratusan ribu pengikut.',
      '"Kalau ada fanart yang menggambarkan karakter kulit putih menjadi Jepang, tidak ada yang komplain. Standar ganda ini yang perlu kita pertanyakan," balas pengguna lain tak kalah sengit.',
      "Kontroversi ini bukan yang pertama dalam komunitas anime. Sebelumnya, debat serupa pernah terjadi ketika sebuah studio animasi barat mengadaptasi anime dengan mengubah ras protagonis. Namun kali ini, eskalasi terjadi lebih cepat dan lebih brutal dari sebelumnya.",
      "Pihak Viz Media, distributor resmi Dandadan di Amerika Serikat, hingga berita ini diturunkan belum memberikan pernyataan resmi. Sementara mangaka Tatsu Yukinobu sendiri tampaknya memilih untuk tidak ikut berkomentar di media sosial.",
      "Para pengamat budaya pop menilai insiden ini sebagai cerminan dari ketegangan yang lebih dalam di komunitas penggemar global — antara interpretasi bebas atas karya seni dan penghormatan terhadap visi orisinal sang kreator.",
    ],
    source: "X.com/@Lynn6Thorex",
    image: "https://images.unsplash.com/photo-1705927450843-3c1abe9b17d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    readTime: 4,
    publishedAt: "2 jam lalu",
    hot: true,
  },
  {
    id: "2",
    category: "Breaking",
    title: "OpenAI Diam-Diam Rilis Model AI Terbaru yang Diklaim Bisa 'Berpikir Seperti Manusia' — Komunitas Skeptis",
    summary:
      "OpenAI meluncurkan GPT-5 secara terbatas tanpa pengumuman resmi. Model baru ini diklaim memiliki kemampuan reasoning yang jauh melampaui pendahulunya.",
    content: [
      "OpenAI kembali mengejutkan dunia teknologi dengan langkah yang tidak terduga. Pada Kamis dini hari waktu San Francisco, perusahaan yang didirikan Sam Altman ini secara senyap mendeploy model AI generasi terbaru mereka ke sejumlah pengguna terpilih tanpa pengumuman resmi di kanal komunikasi mana pun.",
      "Model yang kemudian diidentifikasi oleh komunitas sebagai 'GPT-5' ini pertama kali terdeteksi ketika beberapa pengguna API melaporkan respons yang secara signifikan berbeda dari model sebelumnya — lebih cepat, lebih koheren, dan menunjukkan kemampuan multi-step reasoning yang belum pernah terlihat sebelumnya.",
      '"Saya sedang debug kode Python yang sudah saya perjuangkan selama dua hari. Model baru ini langsung menemukan bug di level ketiga pemanggilan fungsi dan menjelaskan mengapa logika saya salah secara konseptual, bukan hanya sintaksis. Ini beda level," tulis seorang developer bernama @kalpine_dev di X.',
      "Namun tidak semua pihak menyambut dengan antusias. Komunitas AI safety langsung angkat bicara. Eliezer Yudkowsky, tokoh terkemuka dalam diskusi risiko AI, menulis thread panjang yang mempertanyakan keputusan OpenAI untuk merilis model baru tanpa evaluasi keamanan publik yang transparan.",
      '"Setiap kali mereka merilis sesuatu yang lebih pintar tanpa memberitahu dunia, itu bukan kemajuan. Itu judi dengan masa depan kita," tegasnya.',
      "Di sisi lain, para peneliti yang sempat mendapat akses awal menyebutkan bahwa model ini menunjukkan kemampuan luar biasa dalam matematika tingkat lanjut, pemrograman, dan bahkan pemahaman konteks budaya yang sangat nuanced.",
      "OpenAI akhirnya mengkonfirmasi keberadaan model tersebut melalui sebuah blog post singkat 16 jam setelah komunitas pertama kali mendeteksinya. Mereka menyebutnya sebagai 'deployment bertahap untuk evaluasi lebih lanjut' — sebuah jawaban yang membuat lebih banyak pertanyaan daripada yang dijawab.",
    ],
    source: "TechInside.id",
    image: "https://images.unsplash.com/photo-1655393001768-d946c97d6fd1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    readTime: 5,
    publishedAt: "4 jam lalu",
    hot: true,
  },
  {
    id: "3",
    category: "Trending",
    title: "Generasi Z Tinggalkan Instagram, Migrasi Massal ke Platform yang Belum Pernah Kamu Dengar",
    summary:
      "Tren migrasi pengguna muda dari Instagram ke platform-platform niche terus menguat. Apa yang sebenarnya mereka cari dan mengapa Facebook gagal mempertahankan mereka?",
    content: [
      "Laporan terbaru dari lembaga riset digital Pew Research Center mengungkap tren yang mengkhawatirkan bagi Meta: pengguna berusia 18-24 tahun meninggalkan Instagram dengan laju yang terus meningkat selama empat kuartal berturut-turut.",
      "Namun ke mana mereka pergi? Jawabannya mengejutkan: bukan ke TikTok atau YouTube Shorts seperti yang banyak diasumsikan. Melainkan ke platform-platform kecil dan niche yang dibangun di atas filosofi desain yang sangat berbeda.",
      "Cara, sebuah platform berbagi foto yang berfokus pada algoritma kronologis dan tidak ada metric publik seperti jumlah likes, dilaporkan mengalami pertumbuhan pengguna baru sebesar 340% dalam enam bulan terakhir. Mayoritas pengguna barunya adalah Gen Z berusia 18-22 tahun.",
      '"Saya capek merasa diukur terus. Di Instagram, kamu selalu tahu berapa banyak orang yang suka fotomu, berapa views, siapa yang follow siapa. Semua itu bikin kamu terus nge-compare diri sendiri dengan orang lain," kata Raisa, 21 tahun, mahasiswi desain komunikasi visual di Yogyakarta.',
      "Fenomena ini tampaknya bukan sekadar fase. Para analis menyebut ini sebagai 'kelelahan algoritmik' — kondisi di mana pengguna mulai sadar dan muak dengan cara platform besar memanipulasi feed mereka demi memaksimalkan engagement.",
      "Menariknya, beberapa dari platform yang menjadi tujuan migrasi ini justru tidak berusaha keras untuk tumbuh. Mereka membatasi jumlah pengguna, menolak iklan, dan bahkan mempersulit proses pendaftaran — strategi yang jelas bertentangan dengan logika bisnis konvensional Silicon Valley.",
      "Apakah ini sinyal bahwa era platform media sosial masif akan segera berakhir, digantikan oleh ekosistem yang lebih terfragmentasi dan personal? Para peneliti belum sepakat, tapi satu hal yang jelas: apa yang diinginkan anak muda dari internet sedang berubah secara fundamental.",
    ],
    source: "DigitalPulse.id",
    image: "https://images.unsplash.com/photo-1771193950779-27b2802ab4c4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    readTime: 4,
    publishedAt: "6 jam lalu",
  },
  {
    id: "4",
    category: "Discuss",
    title: "Tim Indonesia di Turnamen Esports Dunia: Antara Prestasi Nyata dan Hype yang Menipu",
    summary:
      "Setelah kemenangan mengejutkan di babak grup, tim esports Indonesia menghadapi pertanyaan besar: apakah ini titik balik sejati atau sekadar momen keberuntungan?",
    content: [
      "RRQ Hoshi baru saja mencatatkan sejarah. Dengan kemenangan 3-1 atas tim unggulan dari Korea Selatan di babak delapan besar World Esports Championship, mereka menjadi tim Indonesia pertama yang menembus semifinal dalam sejarah turnamen bergengsi ini.",
      "Namun reaksi komunitas esports Indonesia terbelah. Di satu sisi, euphoria memenuhi media sosial. Tagar #IndonesiaEsports dan #RRQHoshi bertengger di trending Twitter selama hampir 20 jam. Di sisi lain, suara-suara kritis mulai bermunculan, mempertanyakan apakah kemenangan ini merupakan cerminan dari ekosistem esports Indonesia yang matang, atau sekadar hasil matchup yang menguntungkan.",
      '"Korea lagi dalam fase rebuild. Lima pemain inti mereka pensiun tahun lalu. Ini bukan win yang sama dengan mengalahkan Korea di peak mereka," tulis seorang analis esports dengan 90 ribu pengikut.',
      "Di balik perdebatan ini, ada fakta-fakta yang menarik untuk diperhatikan. Rata-rata usia pemain RRQ Hoshi saat ini adalah 19,3 tahun — lebih muda dari tim-tim top Asia Tenggara lainnya. Mereka juga telah menjalani bootcamp intensif selama 6 bulan di Korea, belajar langsung dari tim-tim yang sekarang mereka kalahkan.",
      '"Anak-anak ini berlatih 14 jam sehari. Bukan hype, bukan keberuntungan. Ini hasil kerja keras yang tidak kamu lihat di balik layar," kata pelatih kepala RRQ dalam konferensi pers pasca pertandingan.',
      "Semifinal melawan tim China akan menjadi ujian sesungguhnya. Dan apapun hasilnya, satu hal yang tidak bisa dipungkiri: esports Indonesia sedang bergerak ke arah yang benar.",
    ],
    source: "EsportsID.com",
    image: "https://images.unsplash.com/photo-1772587003187-65b32c91df91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    readTime: 5,
    publishedAt: "8 jam lalu",
  },
  {
    id: "5",
    category: "Opinion",
    title: "Kuliner Jalanan Jakarta Terancam Punah: Ketika 'Autentisitas' Menjadi Komoditas yang Dijual ke Turis",
    summary:
      "Gentrifikasi kuliner di Jakarta mengancam keberadaan pedagang kaki lima yang selama puluhan tahun menjadi tulang punggung identitas kuliner kota ini.",
    content: [
      "Ada yang berubah di sudut-sudut favorit Jakarta. Gang-gang sempit yang dulu dipenuhi aroma gulai dan asap pedagang sate kini semakin digantikan oleh kedai-kedai bergaya Instagram dengan harga yang membuat dompet menangis.",
      "Bukan masalah kemajuan atau kemodernan. Masalahnya jauh lebih dalam: ketika 'autentisitas' dikemas dan dijual sebagai produk premium untuk konsumen menengah ke atas, siapa yang menjadi korban pertama?",
      "Pak Joyo, pedagang mie ayam di bilangan Menteng yang sudah berjualan selama 38 tahun, menceritakan tekanan yang ia rasakan. Sewa lapaknya naik tiga kali lipat dalam lima tahun terakhir. Pelanggan lamanya — para karyawan kantoran, tukang ojek, mahasiswa — semakin berkurang karena area sekitarnya berubah menjadi kawasan komersial kelas atas.",
      '"Dulu saya jual mie ayam seribu perak. Sekarang sudah tiga ribu. Tapi sewa naik jadi dua juta. Kalau saya naikkan lagi, pelanggan saya yang nggak mampu nggak bisa makan di sini," katanya dengan nada yang berat.',
      "Di sisi lain, kita menyaksikan kemunculan restoran-restoran yang mengklaim menjual 'street food autentik Jakarta' dengan harga 5-10 kali lipat dari versi aslinya di jalanan. Ironisnya, restoran-restoran inilah yang justru mendapat liputan media dan kunjungan wisatawan.",
      "Pertanyaan yang perlu kita renungkan bersama: apakah kita sedang melestarikan kuliner, atau sedang membuatnya mati dengan cara yang lebih glamor? Dan siapa yang berhak mendefinisikan 'autentik'?",
      "Jakarta membutuhkan kebijakan yang melindungi pedagang kaki lima dari tekanan gentrifikasi — bukan sekadar regulasi di atas kertas, tapi komitmen nyata dari pemerintah kota untuk memastikan bahwa mereka yang menciptakan identitas kuliner kota ini bisa tetap bertahan.",
    ],
    source: "KulinerNusantara.id",
    image: "https://images.unsplash.com/photo-1755589494214-3e48817a4c9e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    readTime: 5,
    publishedAt: "10 jam lalu",
  },
  {
    id: "6",
    category: "Analisis",
    title: "Bitcoin Tembus $120.000: Kali Ini Berbeda, atau Kita Sedang Mengulangi Sejarah?",
    summary:
      "Dengan Bitcoin mencetak all-time high baru, analis terbagi antara yang melihat siklus bull market baru dan yang khawatir gelembung berikutnya sedang terbentuk.",
    content: [
      "Bitcoin kembali membuat headline global. Aset kripto terbesar di dunia ini menembus level $120.000 untuk pertama kalinya dalam sejarah, melanjutkan rally panjang yang dimulai sejak persetujuan Bitcoin ETF spot oleh SEC pada akhir tahun lalu.",
      "Namun seperti setiap rally sebelumnya, satu pertanyaan menghantui para investor: apakah ini berbeda dari 2017 dan 2021, atau kita sedang menyaksikan pengulangan siklus yang sama?",
      "Argumen untuk kubu 'kali ini berbeda' cukup kuat. Partisipasi institusional sudah jauh lebih dalam dan struktural. BlackRock, Fidelity, dan puluhan asset manager kelas dunia kini mengelola miliaran dolar dalam produk Bitcoin. Ini bukan lagi spekulasi retail semata.",
      "Di sisi lain, data on-chain menunjukkan pola yang mengkhawatirkan. Leverage di pasar derivatif mencapai level tertinggi sepanjang masa. Open interest futures Bitcoin melewati $50 miliar untuk pertama kali. Ini adalah bahan bakar yang bisa membuat rally lebih tinggi — atau membuat koreksi lebih brutal.",
      '"Setiap siklus bull selalu terasa berbeda dari dalamnya. Tapi struktur fundamentalnya selalu sama: euforia, leverage berlebihan, ritel masuk di puncak, smart money keluar. Kita belum menemukan cara untuk keluar dari siklus ini," kata seorang analis kripto senior.',
      "Yang jelas, volatilitas belum pergi. Dalam 24 jam terakhir saja, Bitcoin sempat turun 8% sebelum kembali naik menembus level $120.000. Bagi investor jangka panjang, ini mungkin sekadar noise. Bagi trader, ini adalah lingkungan yang sangat berbahaya.",
    ],
    source: "KriptoAnalitik.id",
    image: "https://images.unsplash.com/photo-1652337037919-62e284ff2839?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    readTime: 6,
    publishedAt: "12 jam lalu",
  },
  {
    id: "7",
    category: "Review",
    title: "Album Baru BLACKPINK Solo Project: Masterpiece atau Mesin Uang YG yang Sudah Kehabisan Ide?",
    summary:
      "Setelah hiatus panjang, salah satu anggota BLACKPINK merilis album solo yang memecah opini Blink secara tajam antara pujian dan kekecewaan.",
    content: [
      "Setelah penantian lebih dari dua tahun, album solo terbaru dari salah satu anggota BLACKPINK akhirnya tiba. Dan seperti yang sudah bisa diprediksi untuk apa pun yang datang dari kelompok K-pop terbesar di dunia ini, reaksinya langsung memenuhi setiap sudut internet.",
      "Album ini hadir dengan 12 track, sebuah konsep visual yang ambisius terinspirasi dari estetika tahun 80-an era Eropa Timur, dan kolaborasi dengan sejumlah produser top dunia. Di atas kertas, ini terdengar sempurna.",
      "Realitanya lebih nuanced. Track pertama dan utama, yang dirancang sebagai banger stadium-filling, memang berhasil. Beat yang hypnotic, vokal yang powerful, dan koreografi yang — berdasarkan video musik — tampak seperti karya sinematografi kelas festival film.",
      'Tapi begitu masuk ke track 4 dan seterusnya, masalah mulai muncul. Ada pola yang mengkhawatirkan: setiap album ini terasa seperti mengejar tren yang sudah lewat. "Y2K revival" sudah dieksploitasi habis oleh artis-artis barat dua tahun lalu. Hadir ke pesta itu sekarang terasa... terlambat.',
      '"Ini bukan artisnya yang bermasalah. Suaranya tetap luar biasa. Yang bermasalah adalah A&R di YG yang tampaknya bekerja dengan data streaming 18 bulan lalu, bukan sekarang," tulis seorang musik kritikus.',
      "Blink yang loyal tentu akan tetap menemukan keindahan di setiap sudut album ini — dan secara objektif, ada momen-momen genuinely brilliant di sini. Tapi bagi pendengar yang berharap melihat seorang artis yang benar-benar berkembang secara artistik dan mengambil risiko kreatif, album ini mungkin akan meninggalkan rasa yang kurang memuaskan.",
    ],
    source: "MusicReview.asia",
    image: "https://images.unsplash.com/photo-1772587003205-e727c3db6f44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    readTime: 4,
    publishedAt: "1 hari lalu",
  },
  {
    id: "8",
    category: "Exclusive",
    title: "Film Horor Lokal Raup 5 Juta Penonton: Sutradara Bicara Soal Resep Sukses dan Industri yang Masih Setengah Hati",
    summary:
      "Di balik kesuksesan box office yang mengejutkan, sutradara film horor terbaru Indonesia membuka suara tentang tantangan industri film nasional yang masih jauh dari ekosistem ideal.",
    content: [
      "Lima juta penonton dalam tiga minggu tayang. Angka itu bukan hanya rekor untuk film horornya sendiri — itu adalah pernyataan bahwa penonton Indonesia haus akan konten berkualitas yang berakar dari budaya mereka sendiri.",
      "Kami berbicara eksklusif dengan sang sutradara, Reza Pratama (38), satu minggu setelah filmnya melampaui semua ekspektasi industri. Ia tampil sederhana, berkaos polos, di sebuah kafe di kawasan Kemang — jauh dari glamor yang mungkin Anda bayangkan untuk seorang pembuat film yang baru mencetak sejarah.",
      '"Jujur, saya tidak menyangka sebesar ini. Target awal saya dua juta penonton. Sudah cukup balik modal dan sedikit untung. Tapi ternyata orang-orang rindu cerita horor yang tidak mengandalkan jump scare murahan," katanya dengan senyum yang tampak masih tidak percaya.',
      "Film yang ia buat mengambil mitologi lokal dari sebuah daerah di Jawa Tengah yang jarang dieksplor. Selama dua tahun ia dan timnya melakukan riset lapangan, berbicara dengan sesepuh desa, mendokumentasikan cerita-cerita yang hampir punah.",
      "Tapi di balik kesuksesannya, Reza tidak segan bicara tentang sisi gelap industri. Ia mengungkapkan bahwa prosesnya jauh dari mulus — dari investor yang sempat menarik diri di tengah produksi karena tidak percaya horor berbasis mitologi bisa laku, hingga bioskop yang awalnya hanya memberi 30 layar.",
      '"Industri kita masih takut ambil risiko. Semua orang mau cerita yang sudah terbukti aman. Tapi penonton sudah lebih maju dari produsernya. Mereka siap dengan hal-hal baru. Kita yang perlu mengejar mereka," tegasnya.',
      "Dengan sequel yang sudah resmi diumumkan dan tawaran adaptasi internasional di meja, Reza Pratama dan filmnya menjadi bukti bahwa sinema Indonesia punya potensi yang selama ini dibiarkan tidur.",
    ],
    source: "FilmIndonesia.co.id",
    image: "https://images.unsplash.com/photo-1762356121454-877acbd554bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    readTime: 6,
    publishedAt: "1 hari lalu",
  },
];

export const CATEGORIES = ["Semua", "Hot Topic", "Breaking", "Trending", "Discuss", "Opinion", "Analisis", "Review", "Exclusive"];
