import templateFooter from './templateFooter';
import templateHeader from './templateHeader';
export const getBaseTemplate = (body: string, logo: string) => {
  let htmlContent = templateHeader(logo);

  htmlContent += body;
  htmlContent += templateFooter;

  return htmlContent;
};
