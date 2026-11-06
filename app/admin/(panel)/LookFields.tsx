import { BUILDS, buildOf, tieColorOf, CLOTHES, COLOR_PRESETS, COMPANIONS, EARRINGS, earringsOf, FACE, HAIR, HAT_STYLES, SHOE_STYLES, SOCKS, TATTOO_PARTS, TATTOO_STYLES,clothesOf, companionOf, faceOf, hairOf, hatOf, shoeOf, socksOf, tattooOf, type Look } from '@/src/content/catalog';
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
  const hat = hatOf(look), hair = hairOf(look), clothes = clothesOf(look), shoe = shoeOf(look), socks = socksOf(look), tattoo = tattooOf(look), ears = earringsOf(look);
  return (
    <>
      <section className="panel-block">
        <h2>捏臉</h2>
        <div className="colors">
          <ColorField name="skin" label="膚色" value={look.skin} presets={COLOR_PRESETS.skin} />
          <ColorField name="eyeColor" label="瞳色" value={f.eyeColor} presets={COLOR_PRESETS.eyes} />
        </div>
        <label className="check"><input type="checkbox" name="blush" defaultChecked={f.blush} /><span>腮紅</span></label>
        <Pick name="build" label="身形" value={buildOf(look)} options={BUILDS} />
        <Pick name="faceShape" label="臉型" value={f.faceShape} options={FACE.faceShape} />
        <Pick name="eyes" label="眼睛" value={f.eyes} options={FACE.eyes} />
        <Pick name="brows" label="眉毛" value={f.brows} options={FACE.brows} />
        <Pick name="nose" label="鼻子" value={f.nose} options={FACE.nose} />
        <Pick name="mouth" label="嘴巴" value={f.mouth} options={FACE.mouth} />
        <Pick name="facialHair" label="鬍子" value={f.facialHair} options={FACE.facialHair} />
        <Pick name="beard" label="鬍子濃淡" value={f.beard} options={FACE.beard} />
      </section>

      <section className="panel-block">
        <h2>髮型與穿著</h2>
        <Pick name="hairLength" label="長度" value={hair.length} options={HAIR.length} />
        <Pick name="hairCurl" label="髮質" value={hair.curl} options={HAIR.curl} />
        <Pick name="hairFront" label="前額" value={hair.front} options={HAIR.front} />
        <Pick name="hairTie" label="綁髮（中長髮、長髮）" value={hair.tie} options={HAIR.tie} />
        <Pick name="hat" label="帽子" value={hat.hat} options={HAT_STYLES} />
        <Pick name="glasses" label="眼鏡" value={f.glasses} options={FACE.glasses} />
        <Pick name="glassesShape" label="鏡框形狀" value={f.glassesShape} options={FACE.glassesShape} />
        <Pick name="earR" label="右耳耳環" value={ears.right} options={EARRINGS} />
        <Pick name="earL" label="左耳耳環" value={ears.left} options={EARRINGS} />
        <fieldset className="pick tattoos">
          <legend>刺青（每個部位各選風格；小腿穿短褲、裙子才看得到）</legend>
          {TATTOO_PARTS.map(p => (
            <label key={p.value}>{p.label}
              <select name={'tat_' + p.value} defaultValue={tattoo[p.value] ?? 'none'}>
                {TATTOO_STYLES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
          <label>刺青文字（選「文字」的部位）<input name="tattooText" defaultValue={typeof look.tattooText === 'string' ? look.tattooText : ''} maxLength={12} placeholder="PEEP" /></label>
        </fieldset>
        <Pick name="companion" label="配件" value={companionOf(look)} options={COMPANIONS} />
        <Pick name="topStyle" label="上衣" value={clothes.style} options={CLOTHES.style} />
        <Pick name="topFit" label="上衣版型" value={clothes.top} options={CLOTHES.top} />
        <Pick name="sleeve" label="袖長" value={clothes.sleeve} options={CLOTHES.sleeve} />
        <Pick name="bottom" label="下身" value={clothes.bottom} options={CLOTHES.bottom} />
        <Pick name="pantsFit" label="下身寬度（長褲、短褲、裙子）" value={clothes.fit} options={CLOTHES.fit} />
        <Pick name="shoeStyle" label="鞋子" value={shoe.style} options={SHOE_STYLES} />
        <Pick name="socks" label="襪子（短褲、裙子、拖鞋看得到）" value={socks.style} options={SOCKS} />
        <div className="colors">
          <ColorField name="hair" label="髮色" value={look.hair} presets={COLOR_PRESETS.hair} />
          <ColorField name="tieColor" label="馬尾髮帶（馬尾、雙馬尾）" value={tieColorOf(look)} presets={COLOR_PRESETS.clothes} />
          <ColorField name="shirt" label="上衣" value={look.shirt} presets={COLOR_PRESETS.clothes} />
          <ColorField name="pants" label="褲子／裙子" value={look.pants} presets={COLOR_PRESETS.clothes} />
          <ColorField name="hatColor" label="帽子顏色" value={hat.color} presets={COLOR_PRESETS.clothes} />
          <ColorField name="shoe" label="鞋子顏色" value={shoe.color} presets={COLOR_PRESETS.clothes} />
          <ColorField name="sock" label="襪子顏色" value={socks.color} presets={COLOR_PRESETS.clothes} />
        </div>
        <div className="colors">
          <label className="short">背號<input name="number" defaultValue={look.number ?? ''} maxLength={2} placeholder="無" /></label>
        </div>
      </section>
    </>
  );
}
