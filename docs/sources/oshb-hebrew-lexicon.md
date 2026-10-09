# OSHB HebrewLexicon: Strong's Hebrew and the BDB index (`oshb-hebrew-lexicon`)

OSHB's XML editions of Strong's Hebrew dictionary (1890), Brown-Driver-Briggs (1906) and the
lexical index linking them, the repository Jot's lexicon ingest uses. Source
https://github.com/openscriptures/HebrewLexicon, fetched 2026-10-09 as the master tarball
(`HebrewLexicon-master.tar.gz`, sha256 `a7ffcef57522754a4c80ceed5790bc76ed6c430817d4410577a39580314edeae`,
4,078,962 bytes) at commit `21c9add13bc727d3a951361778e97e3ff7afd1ce` (2019-09-02). Rights: Strong
and BDB are public domain by date; OSHB's markup is openly licensed (CC BY 4.0, repository readme).
Folder `~/.cache/jot/sources/oshb-hebrew-lexicon/`, 7,106,777 bytes.

Marker scheme: entry ids. `text.txt` line = `<file>:<id><TAB>entry text<TAB>attributes`, for
HebrewStrong (`H6763`), BrownDriverBriggs (`r.cf.ab`) and LexicalIndex. No pages.

How to open a citation: `grep -P '^HebrewStrong:H6763\t' text.txt`; `grep -P '^BrownDriverBriggs:r\.cf\.ab\t' text.txt`.
