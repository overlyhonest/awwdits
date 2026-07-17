/**
 * Calculate design health score from extracted data
 */
export function calculateHealthScore(colorData, typographyData, spacingData) {
  // --- Consistency Score ---
  let consistencyScore = 100;

  if (colorData && colorData.totalUnique > 20) {
    consistencyScore -= (colorData.totalUnique - 20) * 2;
  }

  if (typographyData) {
    const uniqueFontSizes = new Set(typographyData.textStyles.map(s => s.fontSize)).size;
    if (uniqueFontSizes > 8) {
      consistencyScore -= (uniqueFontSizes - 8) * 3;
    }
  }

  if (spacingData && spacingData.totalUnique > 12) {
    consistencyScore -= (spacingData.totalUnique - 12) * 2;
  }

  if (spacingData && (spacingData.scaleDetected === '8pt' || spacingData.scaleDetected === '4pt')) {
    consistencyScore += 5;
  }

  consistencyScore = Math.max(0, Math.min(100, consistencyScore));

  // --- Token Usage Score ---
  let tokenScore = 0;
  if (colorData && colorData.totalUnique > 0) {
    const colorTokens = colorData.colors.filter(c => c.token).length;
    tokenScore = Math.round((colorTokens / colorData.totalUnique) * 100);
  }

  // --- Overall ---
  const overallScore = Math.round(consistencyScore * 0.5 + tokenScore * 0.5);

  return {
    overall: overallScore,
    grade: getGrade(overallScore),
    breakdown: {
      consistency: {
        score: Math.round(consistencyScore),
        status: consistencyScore >= 80 ? 'good' : consistencyScore >= 60 ? 'warning' : 'error',
        label: 'Design Consistency',
      },
      tokenUsage: {
        score: Math.round(tokenScore),
        status: tokenScore >= 70 ? 'good' : tokenScore >= 40 ? 'warning' : 'error',
        label: 'Token Usage',
      },
    },
  };
}

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function getGradeColor(grade) {
  switch (grade) {
    case 'A': return 'text-emerald-600';
    case 'B': return 'text-blue-600';
    case 'C': return 'text-amber-600';
    case 'D': return 'text-orange-600';
    default: return 'text-red-600';
  }
}
