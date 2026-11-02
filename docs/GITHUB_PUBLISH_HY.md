# GitHub-ում FailFirst AI-ը հրապարակելու քայլերը

1. Ստեղծիր **նոր, դատարկ, PUBLIC** GitHub repository `failfirst-ai` անունով՝ `webbitis` հաշվի տակ։ Մի ընտրիր «Initialize with README», որովհետև README-ն արդեն նախագծում կա։
2. Բացիր PowerShell-ը նախագծի `failfirst-ai` թղթապանակում։
3. Գործարկիր ստորև նշված հրամանները։ Ստորև որպես repository-ի owner նշված է `webbitis`-ը։ Նախ GitHub-ում ստեղծիր `webbitis/failfirst-ai` repository-ն։

```powershell
npm ci
npm test
npm run build

git init
git add .
git status
npm run check:publish
git commit -m "Prepare FailFirst AI hackathon MVP"
git branch -M main
git remote add origin https://github.com/webbitis/failfirst-ai.git
git push -u origin main
```

`git add .`-ից հետո և commit-ից առաջ գործարկիր `npm run check:publish`։ Եթե Git-ը պահանջի անուն/էլ․ հասցե, տեղային կարգավորում արա՝ `git config user.name "Your Name"` և `git config user.email "your-github-email"`։

**Շատ կարևոր.** `.env.local`-ը չպետք է հայտնվի `git status`-ի `Changes to be committed` բաժնում։ Այն արդեն `.gitignore`-ում է։ Երբեք մի տեղադրիր API key GitHub-ում, GitHub Issues-ում կամ ChatGPT-ում։

**Public repository-ն պարտադիր է** ըստ Participant Guide-ի։ Մի ընտրիր private. Հրապարակելուց առաջ պարտադիր ստուգիր `.env.local`-ը և `npm run check:publish` արդյունքը։

**Կրկնակի ստուգում.** GitHub-ում բացիր repository-ն, համոզվիր, որ README-ն երևում է, `src/` և `tests/` կան, իսկ `.env.local`, `node_modules/`, `.next/` չկան։

Եթե GitHub repository-ն արդեն գոյություն ունի, մի գործարկիր `git init`/`git remote add origin` առանց ստուգելու եղած Git պատմությունը. այդ դեպքում նախ ստուգիր `git remote -v` և `git status`։
