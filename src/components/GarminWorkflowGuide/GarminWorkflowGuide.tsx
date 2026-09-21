import { Download, ExternalLink, Upload, Wrench } from 'lucide-react';

const EXPORT_FAQ = 'https://support.garmin.com/en-US/?faq=W1TvTPW8JZ6LfJSfK512Q8';
const IMPORT_FAQ = 'https://support.garmin.com/en-US/?faq=Ht3ZP52Kju075uKvqTqu99';

export function GarminWorkflowGuide() {
  return (
    <section className="garminGuide" aria-labelledby="garmin-guide-title">
      <div className="guideHeading">
        <div>
          <h2 id="garmin-guide-title">From Garmin Connect to 3R—and back</h2>
          <p>Use Garmin Connect on a computer to export the original activity and import the validated derivative.</p>
        </div>
        <span>Garmin handoff</span>
      </div>
      <ol className="guideSteps">
        <li><span><Download size={18} /></span><div><strong>Download the original FIT</strong><p>In Garmin Connect Web, open <b>Activities → All Activities</b>, choose the activity, open the settings gear, and select <b>Export File</b>.</p><a href={EXPORT_FAQ} target="_blank" rel="noreferrer">Garmin export instructions <ExternalLink size={13} /></a></div></li>
        <li><span><Wrench size={18} /></span><div><strong>Repair and validate locally</strong><p>Attach the exported <code>.fit</code> file here, review the evidence, select a repair candidate, and create the repaired FIT.</p></div></li>
        <li><span><Upload size={18} /></span><div><strong>Upload the repaired FIT</strong><p>In Garmin Connect Web, select the cloud upload icon, choose <b>Import Data → Browse</b>, select the <code>.repaired.fit</code> file, then import it.</p><a href={IMPORT_FAQ} target="_blank" rel="noreferrer">Garmin upload instructions <ExternalLink size={13} /></a></div></li>
      </ol>
    </section>
  );
}
