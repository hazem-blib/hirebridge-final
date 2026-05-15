const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\LOQ\\Desktop\\hirebridge-employer-review-page-fixed\\src\\app\\features\\employer\\review-candidates\\review-candidates-page.component.html', 'utf8');
const openTags = (content.match(/<div/g) || []).length;
const closeTags = (content.match(/<\/div/g) || []).length;
console.log(`Open: ${openTags}, Close: ${closeTags}`);
