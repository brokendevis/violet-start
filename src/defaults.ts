export interface Link {
  id: string
  title: string
  url: string
}

export interface Group {
  id: string
  name: string
  links: Link[]
}

const presets: [string, [string, string][]][] = [
  ['Tools', [
    ['Kali Tools', 'https://www.kali.org/tools/'],
    ['CyberChef', 'https://gchq.github.io/CyberChef/'],
    ['GTFOBins', 'https://gtfobins.github.io/'],
  ]],
  ['Recon', [
    ['Shodan', 'https://www.shodan.io/'],
    ['Censys', 'https://search.censys.io/'],
    ['urlscan.io', 'https://urlscan.io/'],
  ]],
  ['Analysis', [
    ['Wireshark', 'https://www.wireshark.org/'],
    ['VirusTotal', 'https://www.virustotal.com/gui/home/search'],
    ['MalwareBazaar', 'https://bazaar.abuse.ch/'],
  ]],
  ['Labs', [
    ['PortSwigger', 'https://portswigger.net/web-security'],
    ['Hack The Box', 'https://www.hackthebox.com/'],
    ['picoCTF', 'https://picoctf.org/'],
  ]],
  ['Reference', [
    ['MITRE ATT&CK', 'https://attack.mitre.org/'],
    ['OWASP WSTG', 'https://owasp.org/www-project-web-security-testing-guide/'],
    ['HackTricks', 'https://book.hacktricks.wiki/en/index.html'],
  ]],
]

export const defaultQuote = "I wish I could stay in this moment forever...\nBut then it wouldn't be a moment."

export const defaultGroups: Group[] = presets.map(([name, links], groupIndex) => ({
  id: `group-${groupIndex}`,
  name,
  links: links.map(([title, url], linkIndex) => ({
    id: `link-${groupIndex}-${linkIndex}`,
    title,
    url,
  })),
}))
