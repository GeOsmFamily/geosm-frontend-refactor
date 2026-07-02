/**
 * Calcule les dimensions et le décalage nécessaires pour insérer une image dans un
 * rectangle cible sans la déformer (ajustement "contain", comme `object-fit: contain`
 * en CSS) - jsPDF.addImage() étire toujours l'image aux dimensions exactes fournies,
 * donc sans ce calcul l'image capturée de la carte (dont le ratio dépend de la taille
 * de l'écran) ressort visiblement étirée dans une page PDF au format fixe (A4/A3).
 */
export interface ContainFit {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function fitImageContain(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
): ContainFit {
  const imageRatio = imageWidth / imageHeight;
  const boxRatio = boxWidth / boxHeight;

  let width: number;
  let height: number;
  if (imageRatio > boxRatio) {
    width = boxWidth;
    height = boxWidth / imageRatio;
  } else {
    height = boxHeight;
    width = boxHeight * imageRatio;
  }

  return {
    width,
    height,
    offsetX: (boxWidth - width) / 2,
    offsetY: (boxHeight - height) / 2,
  };
}
