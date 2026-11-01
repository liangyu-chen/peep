import { CLOTHES, COLOR_PRESETS, FACE, HAIR, HAT_STYLES, clothesOf, faceOf, hairOf, hatOf, type Look } from '@/src/content/catalog';
import ColorField from './ColorField';

function Pick({ name, label, value, options }: { name: string; label: string; value: string; options: { value: string; label: string }[] }) {
  return (
    <fieldset className="pick">
      <legend>{label}</legend>
      {options.map(o => (
        <label key={o.value}><input type="radio" name={name} value={o.value} defaultChecked={o.value === value} /><span>{o.label}</span></label>
      ))}
    </fieldset>
  );
}

// the 捏臉 fields shared by the regulars' editor and the owner's page; parseLook() reads them back
export default function LookFields({ look, seed }: { look: Look; seed: string }) {
  const f = faceOf(look, seed);
  const hat = hatOf(look), hair = hairOf(look), clothes = clothesOf(look);
  return (
    <>
      <section className="panel-block">
        <h2>捏臉</h2>
        <div className="colors">
          <ColorField name="skin" label="膚色" value={look.skin} presets={COLOR_PRESETS.skin} />
          <ColorField name="eyeColor" label="瞳色" value={f.eyeColor} presets={COLOR_PRESETS.eyes} />
        </div>
        <label className="check"><input type="checkbox" name="blush" defaultChecked={f.blush} /><span>腮紅</span></label>
        <Pick name="faceShape" label="臉型" value={f.faceShape} options={FACE.faceShape} />
        <Pick name="eyes" label="眼睛" value={f.eyes} options={FACE.eyes} />
        <Pick name="brows" label="眉毛" value={f.brows} options={FACE.brows} />
        <Pick name="nose" label="鼻子" value={f.nose} options={FACE.nose} />
        <Pick name="mouth" label="嘴巴" value={f.mouth} options={FACE.mouth} />
        <Pick name="facialHair" label="鬍子" value={f.facialHair} options={FACE.facialHair} />
        <Pick name="beard" label="鬍子濃淡" value={f.beard} options={FACE.beard} />
        <Pick name="glasses" label="眼鏡" value={f.glasses} options={FACE.glasses} />
      </section>

      <section className="panel-block">
        <h2>髮型與穿著</h2>
        <Pick name="hairLength" label="長度" value={hair.length} options={HAIR.length} />
        <Pick name="hairCurl" label="髮質" value={hair.curl} options={HAIR.curl} />
        <Pick name="hairFront" label="前額" value={hair.front} options={HAIR.front} />
        <Pick name="hairTie" label="綁髮（中長髮、長髮）" value={hair.tie} options={HAIR.tie} />
        <Pick name="hat" label="帽子" value={hat.hat} options={HAT_STYLES} />
        <Pick name="topFit" label="上衣版型" value={clothes.top} options={CLOTHES.top} />
        <Pick name="sleeve" label="袖長" value={clothes.sleeve} options={CLOTHES.sleeve} />
        <Pick name="bottom" label="下身" value={clothes.bottom} options={CLOTHES.bottom} />
        <Pick name="pantsFit" label="褲子寬度" value={clothes.fit} options={CLOTHES.fit} />
        <div className="colors">
          <ColorField name="hair" label="髮色" value={look.hair} presets={COLOR_PRESETS.hair} />
          <ColorField name="shirt" label="上衣" value={look.shirt} presets={COLOR_PRESETS.clothes} />
          <ColorField name="pants" label="褲子／裙子" value={look.pants} presets={COLOR_PRESETS.clothes} />
          <ColorField name="hatColor" label="帽子顏色" value={hat.color} presets={COLOR_PRESETS.clothes} />
        </div>
        <div className="colors">
          <label className="short">背號<input name="number" defaultValue={look.number ?? ''} maxLength={2} placeholder="無" /></label>
        </div>
      </section>
    </>
  );
}
