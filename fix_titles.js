const fs = require('fs');
const path = require('path');

const dir = 'screens/onboarding';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const mapping = {
  'QualificationScreen.tsx': ['REGISTRATION.QUALIFICATION', 'What is your #PROFILETYPE# highest qualification?'],
  'HeightScreen.tsx': ['REGISTRATION.HEIGHT', 'What is your #PROFILETYPE# height?'],
  'CasteScreen.tsx': ['REGISTRATION.CASTE', 'Select your #PROFILETYPE# caste'],
  'DoshamScreen.tsx': ['REGISTRATION.DOSHAM', 'Does your #PROFILETYPE# have dosham?'],
  'GothraScreen.tsx': ['REGISTRATION.GOTHRAM', 'Select your #PROFILETYPE# gothram'],
  'DOBScreen.tsx': ['REGISTRATION.DATEOFBIRTH', 'Select your #PROFILETYPE# date of birth'],
  'HomeTownScreen.tsx': ['REGISTRATION.HOMETOWN', 'Select your #PROFILETYPE# hometown'],
  'EatingHabitScreen.tsx': ['REGISTRATION.EATINGHABITS', 'Select your #PROFILETYPE# eating habits'],
  'ReligionScreen.tsx': ['REGISTRATION.RELIGION', 'Select your #PROFILETYPE# religion'],
  'FamilyDetailsScreen.tsx': ['REGISTRATION.ADDFAMILYDETAILS', 'Add your #PROFILETYPE# family details'],
  'HomeTownLocationScreen.tsx': ['REGISTRATION.HOME_TOWN_TXT', 'Is your #PROFILETYPE# home town same as current location?'],
  'MonthlyIncomeScreen.tsx': ['REGISTRATION.INCOME', 'What is your #PROFILETYPE# monthly income?'],
  'MotherTongueScreen.tsx': ['REGISTRATION.MOTHERTONGUE', 'What is your #PROFILETYPE# mother tongue?'],
  'OccupationScreen.tsx': ['REGISTRATION.OCCUPATION', 'What is your #PROFILETYPE# occupation?'],
  'StarRaasiScreen.tsx': ['REGISTRATION.STARRASSI', 'Select your #PROFILETYPE# rassi & star']
};

for (const file of files) {
  if (!mapping[file]) continue;
  
  const [key, fallback] = mapping[file];
  const filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');

  // Replace old logic with new logic
  const oldPattern1 = /const possessive\s*=\s*PROFILE_POSSESSIVE\[createdBy\](\s*\?\?\s*'their')?\n\s*const title\s*=\s*`[^`]+`/g;
  const oldPattern2 = /const possessive\s*=\s*PROFILE_POSSESSIVE\[createdBy\](\s*\?\?\s*'their')?\n\s*const title\s*=\s*possessive\n\s*\?\s*`[^`]+`\n\s*:\s*t\([^)]+\)\.replace\([^)]+\)/g;
  const oldPattern3 = /const possessive\s*=\s*PROFILE_POSSESSIVE\[createdBy\]\n\s*const title\s*=\s*possessive\n\s*\?\s*`[^`]+`\n\s*:\s*t\([^)]+\)\.replace\([^)]+\)/g;
  const oldPattern4 = /const possessive\s*=\s*PROFILE_POSSESSIVE\[createdBy\]\n\s*const title\s*=\s*`[^`]+`/g;
  const oldPattern5 = /const possessive\s*=\s*PROFILE_POSSESSIVE\[createdBy\](\s*\?\?\s*'their')?.*?\n\s*const title\s*=.*?;/g; // Fallback


  const newLogic = `const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(\`REGISTRATION.\${possessiveKey}\`) : ''
  const title = t('${key}', '${fallback}')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()`;

  let newContent = content;
  let replaced = false;

  const replaceFunc = (match) => { replaced = true; return newLogic; };

  newContent = newContent.replace(oldPattern1, replaceFunc);
  if (!replaced) newContent = newContent.replace(oldPattern2, replaceFunc);
  if (!replaced) newContent = newContent.replace(oldPattern3, replaceFunc);
  if (!replaced) newContent = newContent.replace(oldPattern4, replaceFunc);
  if (!replaced) {
      // Find manually
      const idx1 = newContent.indexOf('const possessive');
      const idx2 = newContent.indexOf('const title', Math.max(0, idx1));
      if (idx1 !== -1 && idx2 !== -1) {
          const idx3 = newContent.indexOf('\n', idx2 + 30);
          if (idx3 !== -1 && idx3 - idx1 < 300) {
              const oldLines = newContent.substring(idx1, idx3);
              if (oldLines.includes('title')) {
                  newContent = newContent.substring(0, idx1) + newLogic + newContent.substring(idx3);
                  replaced = true;
              }
          }
      }
  }

  if (replaced) {
    fs.writeFileSync(filepath, newContent, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`Failed to match in ${file}`);
  }
}
